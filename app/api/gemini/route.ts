import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTeacherAccess } from "@/lib/access";
import { getSetting } from "@/lib/settings";
import { generateWithRetry, withTimeout } from "@/lib/ai";
import {
  DIFFICULTY_LEVELS,
  computeStats,
  detectAnswerKey,
  normalizeDifficulty,
  normalizeMcqAnswer,
  normalizeQuestion,
  reconcileAnswers,
  type SmartPayload,
  type SmartQuestion,
} from "@/lib/ai-exam-build";

const geminiModel = process.env.EXAM_IMPORT_MODEL || "gemini-3.5-flash-lite";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_CHARS = 120_000;
const MAX_MODEL_OUTPUT = 16_384;
const AI_TIMEOUT_MS = 45_000;

export type GenerateOptions = {
  subject?: string;
  grade?: string;
  count?: number;
  types?: string[];
  withExplanation?: boolean;
  customNote?: string;
  focus?: string;
};

type GeneratedQuestion = { type?: string; question?: string; options?: string[]; answer?: string; points?: number; grading?: unknown; explanation?: string };
type GeneratedPayload = { title?: string; questions?: GeneratedQuestion[] };

const DIFFICULTY = ["nhận biết", "thông hiểu", "vận dụng"] as const;

function difficultyPlan(count: number) {
  const plan: Record<string, number> = { "nhận biết": Math.round(count * 0.4), "thông hiểu": Math.round(count * 0.4), "vận dụng": count };
  for (const level of DIFFICULTY) if (!plan[level]) delete plan[level];
  plan["vận dụng"] = Math.max(0, count - (plan["nhận biết"] + plan["thông hiểu"]));
  return Object.entries(plan)
    .filter(([, n]) => n > 0)
    .map(([level, n]) => `${level}: ${n} câu`)
    .join(", ");
}

function buildGeneratePrompt(content: string, opts: GenerateOptions) {
  const count = Math.min(Math.max(Number(opts.count) || 10, 1), 60);
  const types = (opts.types?.length ? opts.types : ["mcq"]).map((t) => {
    if (t === "true_false") return "true_false (Đúng/Sai, mỗi câu gồm 3-5 mệnh đề kèm đáp án)";
    if (t === "short_answer") return "short_answer (trả lời ngắn, nêu grading.acceptedAnswers đầy đủ biến thể đáp án)";
    return "mcq (trắc nghiệm 4 đáp án A/B/C/D)";
  }).join(", ");
  const focus = opts.focus?.trim();
  const note = opts.customNote?.trim();

  return `Bạn là chuyên gia soạn đề thi Việt Nam theo chương trình THPT.
NHIỆM VỤ: Từ TÀI LIỆU bên dưới, TỰ SOẠN câu hỏi mới. KHÔNG được chép lại câu hỏi có sẵn nếu tài liệu không có.

YÊU CẦU BẮT BUỘC:
- Số câu: đúng ${count} câu. Không được ít hơn hoặc nhiều hơn.
- Loại câu hỗ trợ (chỉ dùng các loại này): ${types}.
- Phân bố độ khó: ${difficultyPlan(count)}.
${opts.subject ? `- Môn học: ${opts.subject}.` : ""}
${opts.grade ? `- Khối lớp: ${opts.grade}.` : ""}
- mcq: đúng 4 đáp án A, B, C, D, chỉ có đúng 1 đáp án đúng; đáp án đúng phân bố cân bằng, không dồn cục.
- 3 đáp án sai phải là những đáp án hợp lý gây nhầm lẫn, KHÔNG được vô lý hoặc quá dễ loại.
${opts.withExplanation ? "- Kèm giải thích ngắn cho mỗi câu (trường explanation)." : ""}
${focus ? `- Tập trung vào: ${focus}.` : ""}
${note ? `- Yêu cầu riêng của giáo viên (phải tuân thủ): ${note}` : ""}

CHỈ DÙNG KIẾN THỨC CÓ TRONG TÀI LIỆU. Không bịa sự kiện, công thức, số liệu hoặc định nghĩa không có trong tài liệu. Câu hỏi phải tự đủ nghĩa, không viết "theo tài liệu trên".
Tiêu đề đề lấy từ chủ đề chính của tài liệu.
Trả về JSON đúng response schema.`;
}

function mergeGenerated(chunks: GeneratedPayload[]): GeneratedPayload {
  const seen = new Set<string>();
  const questions: GeneratedQuestion[] = [];
  let title = "";
  for (const chunk of chunks) {
    if (!title && chunk.title) title = chunk.title;
    for (const q of chunk.questions ?? []) {
      const key = (q.question ?? "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      questions.push(q);
    }
  }
  return { title, questions };
}

const extractionPrompt = `Bạn là bộ máy nhập đề thi của A6Class Edu.
Trích xuất CÁC CÂU HỎI ĐÃ CÓ SẴN trong tài liệu và tự nhận diện loại câu hỏi.

Loại hợp lệ: mcq, true_false, short_answer, essay.
- mcq: trắc nghiệm 1 đáp án đúng, options A-D, answer là A/B/C/D.
- true_false: Đúng/Sai; grading.statements gồm text + answer boolean.
- short_answer: trả lời ngắn; grading.acceptedAnswers là các đáp án chấp nhận.
- essay: tự luận; không cần đáp án tự động.

QUY TẮC:
- Không tự tạo câu hỏi mới.
- Giữ nguyên nội dung và đáp án có trong tài liệu.
- Không giải bài, không giải thích, không thêm nội dung.
- Trả về JSON đúng response schema.`;

const smartSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subject: { type: "string" },
    kind: { type: "string", enum: ["mcq", "theory"] },
    answerKeyFound: { type: "boolean" },
    answerKeyNote: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mcq", "true_false", "short_answer", "essay"] },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          points: { type: "number" },
          difficulty: { type: "string" },
          answerSource: { type: "string", enum: ["document", "ai", "unknown"] },
          confidence: { type: "number" },
          needsReview: { type: "boolean" },
          solveNote: { type: "string" },
          rubricPoints: { type: "array", items: { type: "string" } },
          grading: {
            type: "object",
            properties: {
              statements: {
                type: "array",
                items: {
                  type: "object",
                  properties: { text: { type: "string" }, answer: { type: "boolean" } },
                  required: ["text", "answer"],
                },
              },
              acceptedAnswers: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["type", "question"],
      },
    },
  },
  required: ["title", "kind", "questions"],
};

const responseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mcq", "true_false", "short_answer", "essay"] },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          points: { type: "number" },
          explanation: { type: "string" },
          grading: {
            type: "object",
            properties: {
              statements: {
                type: "array",
                items: {
                  type: "object",
                  properties: { text: { type: "string" }, answer: { type: "boolean" } },
                  required: ["text", "answer"],
                },
              },
              acceptedAnswers: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["type", "question", "options", "answer"],
      },
    },
  },
  required: ["title", "questions"],
};

const analyzePrompt = `Bạn là chuyên gia phân tích đề thi Việt Nam. NHIỆM VỤ: đọc TÀI LIỆU và DỰNG LẠI ĐỀ THI đang có trong tài liệu (đây là đề sẵn có, KHÔNG tự soạn câu hỏi mới).

BƯỚC 1 - NHẬN DIỆN:
- kind: "mcq" nếu đa số câu là trắc nghiệm có lựa chọn A/B/C/D; "theory" nếu câu hỏi tự luận/tra lời ngắn (không có lựa chọn).
- answerKeyFound: true nếu trong tài liệu CÓ phần đáp án (thường ở cuối: "ĐÁP ÂN", bảng đáp án, hoặc đáp án ghi ngay sau câu). Ghi rõ trong answerKeyNote là đáp án nằm ở đâu.

BƯỚC 2 - DỰNG TỪNG CÂU:
- Giữ nguyên nội dung câu hỏi, không tự diễn đạt lại, không thêm bớt.
- mcq: options đúng 4 lựa chọn (bỏ tiền tố "A." trong text).
  - NẾU đáp án CÓ SẴN trong tài liệu: answer = chữ cái đúng, answerSource = "document", confidence = 1, needsReview = false.
  - NẾU KHÔNG có đáp án trong tài liệu: ĐỂ TRỐNG answer = "", answerSource = "unknown", needsReview = true.
    (Bước sau hệ thống sẽ tự giải bằng 2 lượt độc lập rồi đối chiếu — BẠN KHÔNG cần tự đoán ở bước này.)
- true_false / short_answer / essay: grading theo đúng ý nghĩa (statements cho true_false, acceptedAnswers cho short_answer).
- points: số điểm nếu tài liệu có ghi, ngược lại 1.

BƯỚC 3 - ĐỘ KHÓ (bắt buộc với câu tự luận/trả lời ngắn, và với cả mcq nếu tiện):
- difficulty chỉ chọn đúng 1 trong: ${DIFFICULTY_LEVELS.join(", ")}.
- rubricPoints: các ý chính cần có trong bài làm, dùng để giáo viên chấm hoặc AI chấm sau này.

Trả về JSON đúng response schema.`;

const solvePrompt = (items: { n: number; question: string; options: string[] }[], run: string) => `Bạn là chuyên gia giải trắc nghiệm Việt Nam. Lượt ${run}.

DANH SÁCH CÂU HỎI CẦN GIẢI (giữ nguyên số thứ tự "n"):
${items
  .map(
    (it) => `[n=${it.n}]
${it.question}
${it.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}`,
  )
  .join("\n\n")}

Với MỖI câu trên, hãy TỰ GIẢI và chọn đáp án đúng duy nhất.
- Suy luận từ kiến thức trong chính câu hỏi và các lựa chọn; nếu cần dùng kiến thức phổ thông của môn học đó.
- Không đoán theo thói quen, không chọn đáp án ngẫu nhiên.
- PHẢI trả lời đủ cho mọi câu, giữ đúng trường "n" đã cho.

Trả về JSON: { "answers": [ { "n": <số thứ tự câu>, "answer": "A|B|C|D", "confidence": 0..1 } ] }`;

const tieBreakPrompt = (q: { n: number; question: string; options: string[] }, cands: string[]) => `Hai lượt giải độc lập cho câu hỏi dưới đây đã cho hai đáp án khác nhau: ${cands.join(" và ")}.

Câu ${q.n}: ${q.question}
A. ${q.options[0] ?? ""}
B. ${q.options[1] ?? ""}
C. ${q.options[2] ?? ""}
D. ${q.options[3] ?? ""}

Hãy tự giải lại từ đầu, phân tích kỹ từng lựa chọn rồi chốt đáp án đúng.
Trả về JSON: { "answer": "A|B|C|D", "confidence": 0..1 }`;

const SOLVE_BATCH = 8;

async function callJson<T>(model: string, contents: string, schema: unknown, timeoutMs = 70_000): Promise<T> {
  const raw = await generateWithRetry(
    (m) => ai.models.generateContent({ model: m, contents, config: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: MAX_MODEL_OUTPUT } }).then((r) => r.text),
    { attempts: 2, timeoutMs },
  );
  const cleaned = (raw || "").replace(/^```jsons*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("AI trả về dữ liệu không đúng định dạng JSON");
  }
}

const solveSchema = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: { n: { type: "number" }, answer: { type: "string" }, confidence: { type: "number" } },
        required: ["n", "answer"],
      },
    },
  },
  required: ["answers"],
};

const oneSchema = {
  type: "object",
  properties: { answer: { type: "string" }, confidence: { type: "number" } },
  required: ["answer"],
};

/**
 * Tu lam dap an khi tai lieu khong co phan dap an:
 * 2 luot giai doc lap -> doi chieu -> lech nhau thi pha the hoan (luot 3).
 * Khong chay cho cau da co dap san trong tai lieu.
 */
async function solveMissingAnswers(
  questions: SmartQuestion[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ questions: SmartQuestion[]; agreed: number }> {
  const todo = questions.filter((q) => q.type === "mcq" && !q.answer);
  if (todo.length === 0) return { questions, agreed: 0 };

  const votes = new Map<number, { a?: string; b?: string; tie?: string }>();
  const totalSteps = todo.length * 2;
  let step = 0;

  for (let i = 0; i < todo.length; i += SOLVE_BATCH) {
    const batch = todo.slice(i, i + SOLVE_BATCH).map((q, j) => ({ n: i + j + 1, question: q.question, options: q.options }));
    const [runA, runB] = await Promise.all([
      callJson<{ answers: { n: number; answer: string }[] }>(geminiModel, solvePrompt(batch, "1"), solveSchema),
      callJson<{ answers: { n: number; answer: string }[] }>(geminiModel, solvePrompt(batch, "2"), solveSchema),
    ]);
    const pick = (res: { answers?: { n: number; answer: string }[] }, n: number) => {
      const hit = res.answers?.find((x) => Number(x.n) === n);
      return hit ? normalizeMcqAnswer(hit.answer, 4) ?? undefined : undefined;
    };
    for (const item of batch) {
      const src = todo[item.n - 1];
      const a = pick(runA, item.n);
      const b = pick(runB, item.n);
      votes.set(src.index, { a, b });
      step += 2;
      onProgress?.(Math.min(step, totalSteps), totalSteps);
    }
  }

  const conflicts = todo.filter((q) => {
    const v = votes.get(q.index);
    return v?.a && v?.b && v.a !== v.b;
  });
  console.info(`[exam-smart] giải tay ${todo.length} câu; ${votes.size - conflicts.length} đồng thuận; ${conflicts.length} cần phá thế hoản`);
  if (conflicts.length) {
    step = todo.length * 2;
    for (const q of conflicts) {
      try {
        const res = await callJson<{ answer: string }>(
          geminiModel,
          tieBreakPrompt({ n: q.index + 1, question: q.question, options: q.options }, [votes.get(q.index)!.a!, votes.get(q.index)!.b!]),
          oneSchema,
        );
        votes.get(q.index)!.tie = normalizeMcqAnswer(res.answer, q.options.length) ?? undefined;
      } catch (error) {
        console.warn(`[exam-smart] phá thế hoản thất bại câu ${q.index + 1}`, error);
      }
      step += 1;
      onProgress?.(Math.min(step, totalSteps + conflicts.length), totalSteps + conflicts.length);
    }
  }

  const { questions: solved, agreed } = reconcileAnswers(questions, votes);
  const unanswered = solved.filter((q) => q.type === "mcq" && !q.answer).length;
  if (unanswered > 0) {
    console.warn(`[exam-smart] còn ${unanswered} câu không lấy được đáp án nào; đánh dấu cho giáo viên xem lại`);
  }
  return { questions: solved, agreed };
}

/** Pipeline "AI đọc tài liệu & tự dựng đề". */
async function runSmartPipeline(
  content: string,
  opts: GenerateOptions,
  onProgress?: (phase: string, done?: number, total?: number) => void,
): Promise<{ payload: SmartPayload; stats: ReturnType<typeof computeStats> }> {
  onProgress?.("analyze");
  const chunks = chunkText(content.slice(0, MAX_TEXT_CHARS));
  const merged: SmartPayload = { questions: [] };
  const keyHeuristic = detectAnswerKey(content.slice(0, 60_000));

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const part = await callJson<SmartPayload>(geminiModel, `${analyzePrompt}

NỘI DUNG TÀI LIỆU:
${chunk}`, smartSchema, 90_000);
    if (!merged.title && part.title) merged.title = part.title;
    if (!merged.subject && part.subject) merged.subject = part.subject;
    if (!merged.kind && part.kind) merged.kind = part.kind;
    merged.answerKeyFound = merged.answerKeyFound || part.answerKeyFound === true;
    if (!merged.answerKeyNote && part.answerKeyNote) merged.answerKeyNote = part.answerKeyNote;
    for (const q of part.questions ?? []) merged.questions!.push(q);
    onProgress?.("analyze", chunkIndex + 1, chunks.length);
  }

  const questions = (merged.questions ?? []).map((q, i) => normalizeQuestion(q, i)).filter((q) => q.question.length > 0);
  // De nghi tu do phat hien bang thuoc tinh dung chu quy, gan cho cau chua ro nguon dap an
  for (const q of questions) {
    if (q.type === "mcq" && q.answer && !q.answerSource) q.answerSource = "document";
    if (q.type === "mcq" && !q.answer) q.answerSource = "unknown";
    if (q.type === "mcq" && !q.answer && keyHeuristic?.[q.index + 1]) {
      q.answer = keyHeuristic[q.index + 1];
      q.answerSource = "document";
      q.needsReview = false;
    }
    if (q.difficulty) q.difficulty = normalizeDifficulty(q.difficulty) ?? q.difficulty;
    const rubric = (q as unknown as { rubricPoints?: string[] }).rubricPoints;
    if (Array.isArray(rubric) && rubric.length) q.grading = { ...(q.grading ?? {}), rubricPoints: rubric.map(String) };
  }
  merged.questions = questions;

  const missing = questions.filter((q) => q.type === "mcq" && !q.answer).length;
  let agreed = 0;
  if (missing > 0) {
    onProgress?.("solve", 0, missing);
    const solved = await solveMissingAnswers(questions, (done, total) => onProgress?.("solve", done, total));
    merged.questions = solved.questions;
    agreed = solved.agreed;
    if (!merged.answerKeyNote) {
      merged.answerKeyNote = agreed > 0
        ? `Tài liệu không có đủ đáp án — AI đã tự làm và đối chiếu ${agreed}/${missing} câu`
        : "Tài liệu không có đủ đáp án — AI đã tự làm";
    }
    onProgress?.("solve", missing, missing);
  }
  // answerKeyFound chi lien quan dap an trong TAI LIEU, khong gan boi so cau AI tu giai.
  merged.answerKeyFound = merged.answerKeyFound === true || keyHeuristic !== null;

  const payload: SmartPayload = { ...merged, questions: merged.questions ?? [] };
  return { payload, stats: computeStats(payload, agreed) };
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const generationConfig = () => ({ responseMimeType: "application/json", responseSchema, maxOutputTokens: MAX_MODEL_OUTPUT });
const retryOpts = { attempts: 2 };

async function extractPdfText(buffer: Buffer) {
  try {
    const parsed = await pdfParse(buffer);
    const text = parsed.text.trim();
    return text.length >= 300 ? text.slice(0, MAX_TEXT_CHARS) : "";
  } catch {
    return "";
  }
}

async function generatePdfFallback(buffer: Buffer, mimeType: string, fileName: string) {
  const safeBytes = new Uint8Array(buffer.byteLength);
  safeBytes.set(buffer);
  const uploaded = await withTimeout(
    ai.files.upload({ file: new Blob([safeBytes.buffer], { type: mimeType }), config: { displayName: fileName, mimeType } }),
    AI_TIMEOUT_MS,
    "Gemini tải PDF quá lâu",
  );
  let processed = uploaded;
  const started = Date.now();
  while (processed.state === "PROCESSING") {
    if (Date.now() - started > AI_TIMEOUT_MS) throw new Error("Gemini xử lý PDF quá lâu");
    await new Promise((resolve) => setTimeout(resolve, 400));
    processed = await ai.files.get({ name: uploaded.name! });
  }
  if (processed.state === "FAILED") throw new Error("Gemini không xử lý được file PDF");
  try {
    const resultText = await generateWithRetry(
      (model) => ai.models.generateContent({
        model,
        contents: [extractionPrompt, { fileData: { fileUri: processed.uri!, mimeType: processed.mimeType || mimeType } }],
        config: generationConfig(),
      }).then((r) => r.text),
      retryOpts,
    );
    return resultText;
  } finally {
    try { if (processed.name) await ai.files.delete({ name: processed.name }); } catch {}
  }
}

const CHUNK_CHARS = 40_000;
const GENERATE_TIMEOUT_MS = 75_000;
const SMART_TIMEOUT_MS = 90_000;

/**
 * PDF scan (không có lớp chữ): tải file lên Gemini Files API rồi bắt Gemini bóc tách
 * thành văn bản thô để pipeline phân tích tiếp.
 */
async function geminiReadScannedPdf(file: File, mimeType: string): Promise<string> {
  const safeBytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await withTimeout(
    ai.files.upload({ file: new Blob([safeBytes.buffer], { type: mimeType }), config: { displayName: file.name, mimeType } }),
    AI_TIMEOUT_MS,
    "Gemini tải PDF quá lâu",
  );
  let processed = uploaded;
  const started = Date.now();
  while (processed.state === "PROCESSING") {
    if (Date.now() - started > AI_TIMEOUT_MS) throw new Error("Gemini xử lý PDF quá lâu");
    await new Promise((resolve) => setTimeout(resolve, 400));
    processed = await ai.files.get({ name: uploaded.name! });
  }
  if (processed.state === "FAILED") throw new Error("Gemini không xử lý được file PDF");
  try {
    const text = await generateWithRetry(
      (model) =>
        ai.models.generateContent({
          model,
          contents: [
            "Bóc tách TOÀN BỘ văn bản trong file PDF này thành văn bản thuần. Giữ nguyên câu hỏi, lựa chọn A/B/C/D, số thứ tự câu và phần đáp án nếu có. Không tóm tắt, không bỏ câu, không tự thêm câu mới.",
            { fileData: { fileUri: processed.uri!, mimeType: processed.mimeType || mimeType } },
          ],
          config: { maxOutputTokens: MAX_MODEL_OUTPUT },
        }).then((r) => r.text),
      { attempts: 2, timeoutMs: SMART_TIMEOUT_MS },
    );
    return (text || "").replace(/^\`\`\`[a-z]*\s*/i, "").replace(/\`\`\`$/i, "").trim();
  } finally {
    try { if (processed.name) await ai.files.delete({ name: processed.name }); } catch {}
  }
}

function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

async function runGenerate(
  content: string,
  opts: GenerateOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<GeneratedPayload> {
  const chunks = chunkText(content.slice(0, MAX_TEXT_CHARS));
  const total = Math.min(Math.max(Number(opts.count) || 10, 1), 60);
  const results: GeneratedPayload[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const perChunk = Math.max(1, Math.ceil(total / chunks.length));
    const result = await generateWithRetry(
      (model) =>
        ai.models.generateContent({
          model,
          contents: buildGeneratePrompt(chunks[i], { ...opts, count: perChunk }),
          config: generationConfig(),
        }).then((r) => r.text),
      { attempts: 2, timeoutMs: GENERATE_TIMEOUT_MS },
    );
    const cleaned = (result || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    try {
      results.push(JSON.parse(cleaned) as GeneratedPayload);
    } catch {
      throw new Error("AI trả về dữ liệu câu hỏi không hợp lệ");
    }
    onProgress?.(i + 1, chunks.length);
  }
  return mergeGenerated(results);
}

function mimeTypeFor(file: File) {
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (file.name.toLowerCase().endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return file.type || "application/octet-stream";
}

function mapError(message: string) {
  if (/429|rate.?limit|quota/i.test(message)) return "Gemini đang quá tải hoặc hết quota. Vui lòng thử lại sau ít phút.";
  if (/timeout|timed out|deadline|quá lâu/i.test(message)) return message.slice(0, 300);
  return `Không thể import đề: ${message.slice(0, 300)}`;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  if (!isTeacherAccess(session.user)) return NextResponse.json({ error: "Chỉ giáo viên mới được import đề" }, { status: 403 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Thiếu GEMINI_API_KEY" }, { status: 500 });
  if ((await getSetting("enableAiImport", "true")) !== "true") {
    return NextResponse.json({ error: "Tính năng AI import đang tắt bởi quản trị viên" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const rawMode = formData.get("mode") as string | null;
  const mode: "smart" | "generate" | "extract" = rawMode === "generate" ? "generate" : rawMode === "extract" ? "extract" : "smart";
  let options: GenerateOptions = {};
  try {
    const raw = formData.get("options");
    options = raw ? (JSON.parse(String(raw)) as GenerateOptions) : {};
  } catch {
    options = {};
  }
  const prompt = (formData.get("prompt") as string | null)?.trim();
  if (!file && !prompt) return NextResponse.json({ error: "Thiếu file hoặc nội dung cần xử lý" }, { status: 400 });
  if (mode === "generate" && !file && !prompt) {
    return NextResponse.json({ error: "Thiếu nội dung để soạn câu hỏi" }, { status: 400 });
  }
  if (file) {
    if (!file.size) return NextResponse.json({ error: "File tải lên rỗng hoặc không hợp lệ" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File quá lớn. Vui lòng chọn file dưới 50 MB." }, { status: 413 });
  }

  const encoder = new TextEncoder();
  let aiLogId: string | null = null;
  let smartStats: ReturnType<typeof computeStats> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n")); } catch {}
      };

      try {
        try {
          const log = await prisma.aiImportLog.create({
            data: {
              userId: session.user.id,
              action: "exam_import",
              provider: "gemini",
              status: "running",
              model: geminiModel,
              prompt: prompt ? prompt.slice(0, 2000) : null,
            },
          });
          aiLogId = log.id;
        } catch {}
        let resultText = "";
        let source: "docx" | "pdf-text" | "pdf-gemini" | "text" | "generate" | "smart" = "text";

        const readDocument = async (target: File): Promise<string> => {
          const buffer = Buffer.from(await target.arrayBuffer());
          if (!buffer.byteLength) return "";
          const lowerName = target.name.toLowerCase();
          if (lowerName.endsWith(".docx")) return (await mammoth.extractRawText({ buffer })).value.trim();
          const parsed = await extractPdfText(buffer);
          if (parsed) return parsed;
          return (await target.text()).trim();
        };

        if (mode === "smart") {
          send({ type: "stage", stage: "extract" });
          let content = "";
          let detected: "docx" | "pdf-text" | "pdf-gemini" | "text" = "text";
          if (file) {
            const lowerName = file.name.toLowerCase();
            if (!lowerName.endsWith(".docx") && !lowerName.endsWith(".pdf") && !file.type.includes("text")) {
              return send({ type: "error", error: "Chỉ hỗ trợ file PDF, Word (.docx) hoặc văn bản thuần" });
            }
            content = await readDocument(file);
            detected = lowerName.endsWith(".docx") ? "docx" : "pdf-text";
          } else {
            content = prompt || "";
          }
          if (!content && file) {
            // PDF scan (không có lớp chữ): nạp thẳng file cho Gemini đọc
            try {
              content = await geminiReadScannedPdf(file, mimeTypeFor(file));
              detected = "pdf-gemini";
            } catch (error) {
              return send({ type: "error", error: mapError(error instanceof Error ? error.message : "lỗi không xác định") });
            }
          }
          if (!content) return send({ type: "error", error: "Không đọc được nội dung tài liệu" });
          console.info(`[exam-smart] content=${content.length} chars; model=${geminiModel}; source=${detected}`);
          const { payload, stats } = await runSmartPipeline(content, options, (phase, done, total) =>
            send({ type: "stage", stage: phase === "solve" ? "solve" : "analyze", meta: { done, total } }),
          );
          if (!payload.questions?.length) return send({ type: "error", error: "AI không tìm thấy câu hỏi nào trong tài liệu" });
          resultText = JSON.stringify(payload);
          source = "smart";
          smartStats = stats;
        } else if (mode === "generate") {
          let content = "";
          if (file) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const lowerName = file.name.toLowerCase();
            if (lowerName.endsWith(".docx")) {
              send({ type: "stage", stage: "extract" });
              content = (await mammoth.extractRawText({ buffer })).value.trim();
            } else {
              send({ type: "stage", stage: "extract" });
              content = await extractPdfText(buffer);
              if (!content) content = (await file.text()).trim();
            }
          } else {
            content = prompt || "";
          }
          if (!content) return send({ type: "error", error: "Không đọc được nội dung tài liệu" });
          console.info(`[exam-generate] content=${content.length} chars; count=${options.count}; model=${geminiModel}`);
          send({ type: "stage", stage: "analyze" });
          const payload = await runGenerate(content, options, (done, total) =>
            send({ type: "stage", stage: "analyze", meta: { done, total } }),
          );
          const wanted = Math.min(Math.max(Number(options.count) || 10, 1), 60);
          const produced = payload.questions?.length ?? 0;
          if (produced < wanted) {
            console.warn(`[exam-generate] produced ${produced}/${wanted} questions`);
          }
          resultText = JSON.stringify(payload);
          source = "generate";
        } else if (file) {
          const buffer = Buffer.from(await file.arrayBuffer());
          if (!buffer.byteLength) return send({ type: "error", error: "Không đọc được dữ liệu file" });
          const lowerName = file.name.toLowerCase();
          const isDocx = lowerName.endsWith(".docx");
          const isPdf = lowerName.endsWith(".pdf");
          const mimeType = mimeTypeFor(file);
          if (!isDocx && !isPdf) return send({ type: "error", error: "Chỉ hỗ trợ file PDF hoặc Word (.docx)" });

          send({ type: "stage", stage: "extract" });

          if (isDocx) {
            const docx = await mammoth.extractRawText({ buffer });
            const content = docx.value.trim();
            if (!content) return send({ type: "error", error: "Không đọc được nội dung trong file Word" });
            console.info(`[exam-import] docx extracted ${content.length} chars; model=${geminiModel}`);
            send({ type: "stage", stage: "analyze" });
            const result = await generateWithRetry(
              (model) => ai.models.generateContent({ model, contents: `${extractionPrompt}\n\nNỘI DUNG ĐỀ:\n${content.slice(0, MAX_TEXT_CHARS)}`, config: generationConfig() }).then((r) => r.text),
              retryOpts,
            );
            resultText = result;
            source = "docx";
          } else {
            const extractedText = await extractPdfText(buffer);
            if (extractedText) {
              console.info(`[exam-import] pdf text extracted ${extractedText.length} chars; model=${geminiModel}`);
              send({ type: "stage", stage: "analyze" });
              const result = await generateWithRetry(
                (model) => ai.models.generateContent({ model, contents: `${extractionPrompt}\n\nNỘI DUNG PDF:\n${extractedText}`, config: generationConfig() }).then((r) => r.text),
                retryOpts,
              );
              resultText = result;
              source = "pdf-text";
            } else {
              console.info(`[exam-import] pdf text extraction empty; fallback=gemini; bytes=${buffer.byteLength}; model=${geminiModel}`);
              send({ type: "stage", stage: "analyze" });
              resultText = await generatePdfFallback(buffer, mimeType, file.name);
              source = "pdf-gemini";
            }
          }
        } else {
          send({ type: "stage", stage: "analyze" });
          const result = await generateWithRetry(
            (model) => ai.models.generateContent({ model, contents: `${extractionPrompt}\n\nNỘI DUNG:\n${prompt!}`, config: generationConfig() }).then((r) => r.text),
            retryOpts,
          );
          resultText = result;
        }

        if (!resultText?.trim()) return send({ type: "error", error: "AI không trả về dữ liệu câu hỏi" });

        send({ type: "stage", stage: "check" });
        const elapsedMs = Date.now() - startedAt;
        console.info(`[exam-import] completed in ${elapsedMs}ms; model=${geminiModel}; source=${source}; smart=${JSON.stringify(smartStats)}`);
        const smartMeta = smartStats ? { smart: smartStats } : {};
        send({ type: "result", result: resultText, meta: { model: geminiModel, source, elapsedMs, ...smartMeta } });
        if (aiLogId) {
          await prisma.aiImportLog.update({
            where: { id: aiLogId },
            data: { status: "success", meta: { source, elapsedMs, ...smartMeta } },
          }).catch(() => {});
        }
      } catch (error) {
        const elapsedMs = Date.now() - startedAt;
        console.error(`[exam-import] failed after ${elapsedMs}ms`, error);
        const message = error instanceof Error ? error.message : "Lỗi không xác định";
        send({ type: "error", error: mapError(message) });
        if (aiLogId) {
          await prisma.aiImportLog.update({
            where: { id: aiLogId },
            data: { status: "failed", error: message.slice(0, 1000) },
          }).catch(() => {});
        }
        try {
          await prisma.appLog.create({
            data: { type: "error", message: `exam-import: ${message.slice(0, 500)}`, meta: { elapsedMs } },
          });
        } catch {}
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
