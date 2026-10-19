import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { isTeacherAccess } from "@/lib/access";
import { getSetting } from "@/lib/settings";
import { generateWithRetry, withTimeout } from "@/lib/ai";
import {
  DIFFICULTY_LEVELS,
  computeStats,
  detectAnswerKey,
  normalizeDifficulty,
  normalizeQuestion,
  type SmartPayload,
} from "@/lib/ai-exam-build";
import { solveMissingAnswers } from "@/lib/ai-solve";
import { extractDocImages, type DocImage } from "@/lib/exam-images";
import { extractDocxText, reconcileDocKey, type DocxKey } from "@/lib/exam-docx";
import { segmentQuestions, formatBlocks } from "@/lib/exam-segment";
import { parseExamText, type ParseIssue } from "@/lib/exam-parse";
import { extractPdfLayoutText } from "@/lib/pdf-layout";
import { groqChatJson } from "@/lib/groq-import";

/* Đồng bộ DEFAULT_MODEL ở lib/ai.ts: flash thường (free tier) thay vì flash-lite.
 * Đổi chi phí/tự chọn model thì set EXAM_IMPORT_MODEL trên Vercel. */
const geminiModel = process.env.EXAM_IMPORT_MODEL || "gemini-3.5-flash";
/* Đồng bộ với MAX_UPLOAD_BYTES ở lib/import-exam.ts: Vercel chặn body trên
   ~4.5MB trước khi function chạy nên mức này chỉ là phòng thủ lớp hai. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 120_000;
// 20 câu kèm options + giải thích dễ vượt 16k token → JSON cụt đuôi, parse fail
// ("chẳng nhận diện được câu nào"). 24k đủ cho đề dài, tốn thêm chỉ khi dùng.
const MAX_MODEL_OUTPUT = 24_576;
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
- mcq: đúng 4 đáp án A, B, C, D, chỉ có đúng 1 đáp án đúng; đáp án đúng phân bố cân bằng, không dồn cục; trường answer CHỈ là đúng 1 ký tự A/B/C/D, không kèm nội dung đáp án.
- 3 đáp án sai phải là những đáp án hợp lý gây nhầm lẫn, KHÔNG được vô lý hoặc quá dễ loại.
${opts.withExplanation ? "- Kèm giải thích ngắn cho mỗi câu (trường explanation)." : ""}
${focus ? `- Tập trung vào: ${focus}.` : ""}
${note ? `- Yêu cầu riêng của giáo viên (phải tuân thủ): ${note}` : ""}

CHỈ DÙNG KIẾN THỨC CÓ TRONG TÀI LIỆU. Không bịa sự kiện, công thức, số liệu hoặc định nghĩa không có trong tài liệu. Câu hỏi phải tự đủ nghĩa, không viết "theo tài liệu trên".
Tiêu đề đề lấy từ chủ đề chính của tài liệu.
Trả về JSON đúng response schema.

TÀI LIỆU:
${content}`;
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
- Dòng đáp án nào cuối có ghi "[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]" thì lấy đúng chữ cái đó, KHÔNG đưa marker vào options.
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
          type: { type: "string", enum: ["mcq", "true_false", "short_answer", "essay", "skip"] },
          blocks_used: { type: "array", items: { type: "integer" } },
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
        required: ["type", "question", "options", "answer", "blocks_used"],
      },
    },
  },
  required: ["title", "kind", "questions"],
};

const analyzePrompt = `Bạn là chuyên gia phân tích đề thi Việt Nam. NHIỆM VỤ: đọc TÀI LIỆU và DỰNG LẠI ĐỀ THI đang có trong tài liệu (đây là đề sẵn có, KHÔNG tự soạn câu hỏi mới).

BƯỚC 1 - NHẬN DIỆN:
- kind: "mcq" nếu đa số câu là trắc nghiệm có lựa chọn A/B/C/D; "theory" nếu câu hỏi tự luận/tra lời ngắn (không có lựa chọn).
- answerKeyFound: true nếu trong tài liệu CÓ phần đáp án (thường ở cuối: "ĐÁP ÂN", bảng đáp án, hoặc đáp án ghi ngay sau câu). Ghi rõ trong answerKeyNote là đáp án nằm ở đâu.

BƯỚC 2 - DỰNG TỪNG CÂU (ĐIỂM DANH BẮT BUỘC):
- Tài liệu đã cắt sẵn thành các KHỐI đánh số. Với MỖI khối, trả đúng 1 mục.
- Mỗi mục ghi "blocks_used" = số các khối đã dùng (kể cả khối chỉ góp 1 ý).
  Mọi khối từ 1 đến hết bài đều phải xuất hiện trong blocks_used của ít nhất
  1 mục. TUYỆT ĐỐI không bỏ sót khối nào, không gộp 2 khối xa nhau thành 1 câu
  khi mỗi khối đã là 1 câu hoàn chỉnh.
- Khối nào THẬT SỰ không phải câu hỏi (mục lục, tiêu đề chung, lời giải lẻ
  không kèm câu hỏi) thì liệt kê với type="skip" và ghi rõ lý do vào question
  (vd "Mục lục"). Tối đa 3 mục skip cho cả bài — CẤM dùng skip để né việc
  (máy chủ đếm và bắt chạy bù). Không bịa câu hỏi từ khối skip.
- Giữ nguyên nội dung câu hỏi, không tự diễn đạt lại, không thêm bớt.
- mcq: options đúng 4 lựa chọn (bỏ tiền tố "A." trong text).
- NẾU đáp án CÓ SẴN trong tài liệu: answer = chữ cái đúng, answerSource = "document",
confidence = 1, needsReview = false.
- Dòng đáp án nào cuối có ghi "[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]" (giáo viên tô màu đáp án đúng) thì lấy đúng chữ cái đó, KHÔNG tự suy luận lại, KHÔNG đưa marker vào options.
  - NẾU KHÔNG có đáp án trong tài liệu: ĐỂ TRỐNG answer = "", answerSource = "unknown", needsReview = true.
    (Bước sau hệ thống sẽ tự giải bằng 2 lượt độc lập rồi đối chiếu — BẠN KHÔNG cần tự đoán ở bước này.)
- true_false / short_answer / essay: grading theo đúng ý nghĩa (statements cho true_false, acceptedAnswers cho short_answer).
- points: số điểm nếu tài liệu có ghi, ngược lại 1.

BƯỚC 3 - ĐỘ KHÓ (bắt buộc với câu tự luận/trả lời ngắn, và với cả mcq nếu tiện):
- difficulty chỉ chọn đúng 1 trong: ${DIFFICULTY_LEVELS.join(", ")}.
- rubricPoints: các ý chính cần có trong bài làm, dùng để giáo viên chấm hoặc AI chấm sau này.

Trả về JSON đúng response schema.`;

/**
 * AI-8 — gọi Gemini trước, sập hết (429/503/5xx, hết attempts) mới qua Groq.
 * Groq chỉ gánh được prompt CHỮ thuần (không vision/schema) — có ảnh thì ném
 * lỗi Gemini gốc để caller báo đúng. Trả kèm provider để ghi vào meta/log.
 */
async function generateTextWithFallback(
  prompt: string,
  images: VisionFile[],
  opts: { attempts?: number; timeoutMs?: number; forceGroq?: boolean } = {},
): Promise<{ text: string; provider: "gemini" | "groq" }> {
  const { attempts = 2, timeoutMs = 75_000, forceGroq = false } = opts;
  if (forceGroq) {
    if (images.length) throw new Error("Chế độ test Groq không hỗ trợ ảnh minh họa");
    console.info("[exam-import] force provider=groq (A/B test)");
    const text = await groqChatJson(prompt, Math.min(timeoutMs, 60_000));
    return { text, provider: "groq" };
  }
  try {
    const text = await generateWithRetry(
      (model) =>
        ai.models.generateContent({
          model,
          contents: withVision(prompt, images),
          config: generationConfig(),
        }).then((r) => r.text),
      { attempts, timeoutMs },
    );
    return { text, provider: "gemini" };
  } catch (geminiErr) {
    if (images.length) throw geminiErr;
    console.warn("[exam-import] Gemini sập, chuyển Groq dự phòng");
    const text = await groqChatJson(prompt, Math.min(timeoutMs, 60_000));
    return { text, provider: "groq" };
  }
}

function parseJson<U>(raw: string | null | undefined): U {
  const cleaned = (raw || "").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as U;
  } catch {
    throw new Error("AI trả về dữ liệu câu hỏi không hợp lệ");
  }
}

async function callJson<T>(model: string, contents: string | (string | VisionPart)[], schema: unknown, timeoutMs = 70_000, forceGroq = false, temperature = 0.2): Promise<{ data: T; provider: "gemini" | "groq" }> {
  if (forceGroq && typeof contents !== "string") {
    throw new Error("Chế độ test Groq không hỗ trợ ảnh minh họa");
  }
  if (forceGroq) {
    console.info("[exam-import] force provider=groq (A/B test)");
    return { data: parseJson<T>(await groqChatJson(contents as string, Math.min(timeoutMs, 60_000))), provider: "groq" };
  }
  if (typeof contents === "string") {
    try {
      const raw = await generateWithRetry(
        (m) => ai.models.generateContent({ model: m, contents, config: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: MAX_MODEL_OUTPUT, temperature } }).then((r) => r.text),
        { attempts: 2, timeoutMs },
      );
      return { data: parseJson<T>(raw), provider: "gemini" };
    } catch {
      console.warn("[exam-import] Gemini sập, chuyển Groq dự phòng");
      const raw = await groqChatJson(contents, Math.min(timeoutMs, 60_000));
      return { data: parseJson<T>(raw), provider: "groq" };
    }
  }
  const raw = await generateWithRetry(
    (m) => ai.models.generateContent({ model: m, contents, config: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: MAX_MODEL_OUTPUT, temperature } }).then((r) => r.text),
    { attempts: 2, timeoutMs },
  );
  return { data: parseJson<T>(raw), provider: "gemini" };
}

/** Pipeline "AI đọc tài liệu & tự dựng đề". */
async function runSmartPipeline(
  content: string,
  opts: GenerateOptions,
  onProgress?: (phase: string, done?: number, total?: number) => void,
  // AI-7: ảnh chỉ gắn vào chunk đầu (đủ để model thấy toàn cảnh, đỡ tốn quota;
  // các vòng solve sau làm việc trên chữ đã diễn đạt lại).
  images: VisionFile[] = [],
  forceGroq = false,
  // AI-9: key đáp án tô màu trích độc lập — đối chiếu sau solve, tính lại stats.
  docKey: DocxKey[] = [],
): Promise<{ payload: SmartPayload; stats: ReturnType<typeof computeStats>; provider: "gemini" | "groq"; coverage: { total: number; covered: number; missing: number[] } | null }> {
  onProgress?.("analyze");
  // AI-10: cắt khối xác định + bắt model điểm danh từng khối (kể cả type=skip
  // cho khối không phải câu hỏi). Không còn chuyện rớt câu im lặng.
  const { blocks, preamble } = segmentQuestions(content);
  const useBlocks = blocks.length > 0;
  const analyzeInput = useBlocks ? formatBlocks(blocks, preamble) : content.slice(0, MAX_TEXT_CHARS);
  const chunks = chunkText(analyzeInput);
  const merged: SmartPayload = { questions: [] };
  const keyHeuristic = detectAnswerKey(content.slice(0, 60_000));
  let provider: "gemini" | "groq" = "gemini";
  const covered = new Set<number>();
  const skipCovered = new Set<number>();
  // Skip quá 3 thì phần thừa không tính (chống model né việc bằng skip).
  const MAX_SKIP = 3;
  const collect = (items: SmartPayload["questions"]) => {
    for (const q of items ?? []) {
      merged.questions!.push(q);
      const bu = (q as { blocks_used?: unknown }).blocks_used;
      if (!Array.isArray(bu)) continue;
      const isSkip = (q as { type?: unknown }).type === "skip";
      for (const n of bu) {
        if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > blocks.length) continue;
        if (isSkip) {
          if (skipCovered.size < MAX_SKIP) skipCovered.add(n as number);
        } else {
          covered.add(n as number);
        }
      }
    }
  };
  const isCovered = (i: number) => covered.has(i) || skipCovered.has(i);

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const prompt = `${analyzePrompt}

NỘI DUNG TÀI LIỆU:
${chunk}`;
    // Đọc-dựng là việc xác định (deterministic): temperature thấp để số câu
    // trích ra ổn định giữa các lần chạy, đỡ cảnh lúc 20 lúc 1 câu.
    const part = await callJson<SmartPayload>(
      geminiModel,
      chunkIndex === 0 ? withVision(prompt, images) : prompt,
      smartSchema,
      90_000,
      forceGroq,
      0.1,
    );
    if (part.provider === "groq") provider = "groq";
    const body = part.data;
    if (!merged.title && body.title) merged.title = body.title;
    if (!merged.subject && body.subject) merged.subject = body.subject;
    if (!merged.kind && body.kind) merged.kind = body.kind;
    merged.answerKeyFound = merged.answerKeyFound || body.answerKeyFound === true;
    if (!merged.answerKeyNote && body.answerKeyNote) merged.answerKeyNote = body.answerKeyNote;
    collect(body.questions);
    onProgress?.("analyze", chunkIndex + 1, chunks.length);
  }

  // Khối nào chưa được điểm danh thì chạy bù đúng các khối đó (tối đa 1 lần).
  let missingBlocks: number[] = [];
  if (useBlocks) {
    missingBlocks = blocks.map((b) => b.index).filter((i) => !isCovered(i));
  }
  if (missingBlocks.length) {
    console.info(`[exam-blocks] thiếu khối ${missingBlocks.join(",")} — chạy bù 1 lần`);
    onProgress?.("analyze", chunks.length, chunks.length + 1);
    try {
      const retryText =
        `LẦN TRƯỚC CÒN SÓT — chỉ xử lý các khối sau, các khối khác bỏ qua:\n\n` +
        formatBlocks(blocks.filter((b) => missingBlocks.includes(b.index)));
      const retry = await callJson<SmartPayload>(
        geminiModel,
        `${analyzePrompt}\n\nNỘI DUNG TÀI LIỆU:\n${retryText}`,
        smartSchema,
        90_000,
        forceGroq,
        0.1,
      );
      if (retry.provider === "groq") provider = "groq";
      const rb = retry.data;
      if (!merged.title && rb.title) merged.title = rb.title;
      if (!merged.subject && rb.subject) merged.subject = rb.subject;
      if (!merged.kind && rb.kind) merged.kind = rb.kind;
      if (!merged.answerKeyNote && rb.answerKeyNote) merged.answerKeyNote = rb.answerKeyNote;
      collect(rb.questions);
    } catch (error) {
      console.warn("[exam-blocks] chạy bù thất bại", error);
    }
    missingBlocks = blocks.map((b) => b.index).filter((i) => !isCovered(i));
  }
  const coverage = useBlocks
    ? { total: blocks.length, covered: [...blocks.map((b) => b.index)].filter((i) => isCovered(i)).length, missing: missingBlocks }
    : null;

  // AI-10: mục skip chỉ để điểm danh, không phải câu hỏi — loại trước khi chấm/tính.
  const questions = (merged.questions ?? []).map((q, i) => normalizeQuestion(q, i)).filter((q) => q.question.length > 0 && q.type !== "skip");
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
    const solved = await solveMissingAnswers(questions, (done, total) => onProgress?.("solve", done, total), forceGroq);
    if (solved.provider === "groq") provider = "groq";
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

  // AI-9: key màu đỏ thắng model (model đã được gợi ý bằng marker inline, đây
  // là lưới an toàn không tin model). Tính lại stats sau override.
  if (docKey.length) {
    const rec = reconcileDocKey(merged.questions ?? [], docKey);
    merged.questions = rec.questions;
    if (rec.overridden > 0) {
      merged.answerKeyFound = true;
      console.info(`[exam-docx] key màu đỏ override ${rec.overridden} đáp án`);
    }
    // Tài liệu CÓ tô màu đáp án mà câu nào vẫn do AI tự giải (không trúng key)
    // thì luôn đánh needsReview — đồng thuận ≠ khớp key (đã thấy case AI tự tin
    // mà lệch key). Im lặng nhận mới là lỗi nghiêm trọng.
    for (const q of merged.questions ?? []) {
      if (q.answerSource !== "document") q.needsReview = true;
    }
  }

  const payload: SmartPayload = { ...merged, questions: merged.questions ?? [] };
  return { payload, stats: computeStats(payload, agreed), provider, coverage };
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
  // AI-7: lý thuyết + hình đi cùng nhau nên gắn ảnh mọi chunk (thường 1 chunk).
  images: VisionFile[] = [],
  forceGroq = false,
): Promise<{ payload: GeneratedPayload; provider: "gemini" | "groq" }> {
  const chunks = chunkText(content.slice(0, MAX_TEXT_CHARS));
  const total = Math.min(Math.max(Number(opts.count) || 10, 1), 60);
  const results: GeneratedPayload[] = [];
  let provider: "gemini" | "groq" = "gemini";
  for (let i = 0; i < chunks.length; i++) {
    const perChunk = Math.max(1, Math.ceil(total / chunks.length));
    const prompt = buildGeneratePrompt(chunks[i], { ...opts, count: perChunk });
    const r = await generateTextWithFallback(prompt, images, { attempts: 2, timeoutMs: GENERATE_TIMEOUT_MS, forceGroq });
    if (r.provider === "groq") provider = "groq";
    results.push(parseJson<GeneratedPayload>(r.text));
    onProgress?.(i + 1, chunks.length);
  }
  return { payload: mergeGenerated(results), provider };
}

function mimeTypeFor(file: File) {
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (file.name.toLowerCase().endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return file.type || "application/octet-stream";
}

/* ── AI-7 · Hình minh họa ─────────────────────────────────────────────
   Tách ảnh từ file → nạp lên Gemini Files API → kèm vào prompt để model
   "nhìn". Mọi dữ kiện trong hình BẮT BUỘC diễn đạt lại thành chữ/số trong đề
   (cấm "xem Hình 1" vì đề xuất ra không kèm hình). File tạm xóa sau chạy. */

type VisionFile = { uri: string; mimeType: string; name?: string | null };
type VisionPart = { fileData: { fileUri: string; mimeType: string } };

const VISION_NOTE = `HÌNH ẢNH MINH HỌA ĐÍNH KÈM: ngoài chữ trên còn có hình ảnh của tài liệu. Mọi dữ kiện trong hình (số liệu, bảng biểu, đồ thị, sơ đồ, hình vẽ) BẮT BUỘC phải được diễn đạt lại thành chữ/số đầy đủ ngay trong nội dung câu hỏi, đáp án và giải thích. TUYỆT ĐỐI không viết các cụm như "xem hình", "Hình 1", "biểu đồ trên", "như hình vẽ" vì đề thi xuất ra KHÔNG kèm hình.`;

function withVision(promptText: string, images: VisionFile[]): string | (string | VisionPart)[] {
  if (!images.length) return promptText;
  return [
    `${promptText}\n\n${VISION_NOTE}`,
    ...images.map((f) => ({ fileData: { fileUri: f.uri, mimeType: f.mimeType } })),
  ];
}

async function uploadVisionImages(found: DocImage[]): Promise<VisionFile[]> {
  // AI-10 fix: upload SONG SONG với trần 20s/ảnh, không nối tiếp — Gemini chập
  // chờn mà treo từng ảnh 45s thì 8 ảnh = 360s, Vercel giết function giữa chừng
  // (ECONNRESET) trước cả khi tới fallback Groq. Hỏng/thiếu ảnh nào thì pipeline
  // chữ vẫn chạy (ghi log để biết).
  const settled = await Promise.allSettled(
    // extractDocImages đã giới hạn 8 ảnh — nạp hết, không cắt bớt lần nữa.
    found.map((img) =>
      withTimeout(
        ai.files
          .upload({
            // Copy sang ArrayBuffer mới: Uint8Array view từ Buffer pool không
            // thỏa kiểu BlobPart của TS (dù runtime vẫn chạy).
            file: new Blob([new Uint8Array(img.bytes)], { type: img.mimeType }),
            config: { displayName: "doc-image", mimeType: img.mimeType },
          })
          .then((up): VisionFile => {
            const uri = (up as { uri?: string } | null)?.uri;
            const name = (up as { name?: string | null } | null)?.name ?? null;
            if (!uri) throw new Error("missing uri");
            return { uri, mimeType: img.mimeType, name };
          }),
        20_000,
        "Gemini tải ảnh quá lâu",
      ).catch((e: unknown): null => {
        console.warn("[exam-vision] bỏ 1 ảnh:", e instanceof Error ? e.message.slice(0, 120) : e);
        return null;
      }),
    ),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<VisionFile> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);
}

async function deleteVisionFiles(files: VisionFile[]) {
  for (const f of files) {
    try {
      if (f.name) await ai.files.delete({ name: f.name });
    } catch {
      // Bỏ qua, file tạm trên Gemini tự hết hạn.
    }
  }
}

/** Tách + nạp ảnh rồi gọi fn, xong xóa file tạm. Không bao giờ ném lỗi ảnh. */
async function withDocVision<T>(
  buffer: Buffer | null,
  fileName: string,
  fn: (images: VisionFile[]) => Promise<T>,
): Promise<T> {
  let uploaded: VisionFile[] = [];
  try {
    if (buffer && buffer.byteLength) {
      const found = await extractDocImages(buffer, fileName);
      if (found.length) {
        uploaded = await uploadVisionImages(found);
        console.info(`[exam-vision] ${uploaded.length}/${found.length} images from ${fileName}`);
      }
    }
    return await fn(uploaded);
  } finally {
    if (uploaded.length) await deleteVisionFiles(uploaded);
  }
}

function mapError(message: string) {
  if (/429|rate.?limit|quota/i.test(message)) return "Gemini đang quá tải hoặc hết quota. Vui lòng thử lại sau ít phút.";
  // 503 cao điểm (UNAVAILABLE/high demand/overloaded): tạm thời, thử lại sau.
  // Không có thì JSON thô của Google lọt ra UI như user đã chụp.
  if (/503|unavailable|high demand|overloaded|capacity/i.test(message)) return "AI đang đông người dùng (nghẽn tạm thời). Bạn đợi 2–3 phút rồi bấm “Thử lại” nhé!";
  // Model bị Google khai tử (từng lọt JSON thô ra UI): báo gọn thay vì dump kỹ thuật.
  if (/404|not.?found|no longer available/i.test(message)) return "Model AI vừa được Google cập nhật. Thử bấm “Thử lại” sau ít phút nhé!";
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

  /* AI-6f — hai kiểu gọi: multipart cũ (file ≤4MB) và JSON {storagePath}
     cho file lớn đã up thẳng lên Supabase (body nhỏ, qua được Vercel). */
  const BUCKET = "exam-docs";
  const isJson = (request.headers.get("content-type") || "").includes("application/json");
  let file: File | null = null;
  let rawMode: string | null = null;
  let options: GenerateOptions = {};
  let prompt: string | undefined;
  let tempPath: string | null = null;

  // AI-8 test hook: ép engine để A/B (route đã chặn role GV ở trên).
  let forceGroq = false;
  if (isJson) {
    const body = (await request.json().catch(() => ({}))) as {
      storagePath?: unknown; mode?: unknown; options?: unknown; prompt?: unknown; forceProvider?: unknown;
    };
    forceGroq = body.forceProvider === "groq";
    const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
    rawMode = typeof body.mode === "string" ? body.mode : null;
    if (body.options && typeof body.options === "object") options = body.options as GenerateOptions;
    if (typeof body.prompt === "string") prompt = body.prompt.trim() || undefined;
    if (storagePath) {
      // Nhốt theo userId: client chỉ thấy path của chính mình từ /api/uploads/sign.
      if (!storagePath.startsWith(`${session.user.id}/`)) {
        return NextResponse.json({ error: "Đường dẫn tài liệu không hợp lệ" }, { status: 400 });
      }
      const { data: blob, error: dlError } = await supabaseAdmin.storage.from(BUCKET).download(storagePath);
      if (dlError || !blob) {
        return NextResponse.json({ error: "Không tải được tài liệu từ kho (có thể đã hết hạn, hãy tải lại)" }, { status: 400 });
      }
      const base = storagePath.split("/").pop() || "tailieu";
      file = new File([blob], base, { type: (blob as Blob).type || "application/octet-stream" });
      tempPath = storagePath;
    }
  } else {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
    rawMode = formData.get("mode") as string | null;
    try {
      const raw = formData.get("options");
      options = raw ? (JSON.parse(String(raw)) as GenerateOptions) : {};
    } catch {
      options = {};
    }
    prompt = (formData.get("prompt") as string | null)?.trim() || undefined;
    if (formData.get("forceProvider") === "groq") forceGroq = true;
  }

  const mode: "smart" | "generate" | "extract" | "parse" = rawMode === "parse" ? "parse" : rawMode === "generate" ? "generate" : rawMode === "extract" ? "extract" : "smart";
  if (!file && !prompt) return NextResponse.json({ error: "Thiếu file hoặc nội dung cần xử lý" }, { status: 400 });
  if (mode === "generate" && !file && !prompt) {
    return NextResponse.json({ error: "Thiếu nội dung để soạn câu hỏi" }, { status: 400 });
  }
  if (file) {
    if (!file.size) return NextResponse.json({ error: "File tải lên rỗng hoặc không hợp lệ" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File quá lớn (tối đa 4 MB). Hãy nén PDF lại, chia nhỏ tài liệu, hoặc dán đoạn cần thiết vào ô văn bản." }, { status: 413 });
  }

  const encoder = new TextEncoder();
  let aiLogId: string | null = null;
  let smartStats: ReturnType<typeof computeStats> | null = null;
  // PARSE-1: cảnh báo đọc rule (thiếu đáp án, khối không rõ…) — trả trong meta.
  let parseIssues: ParseIssue[] | null = null;
  // PARSE-1: số ảnh nhúng trong docx (chỉ đếm) — parser dùng để cảnh báo
  // "file có hình, kiểm tra câu phụ thuộc hình".
  let docxImages = 0;
  // AI-7: số ảnh đã nạp cho model (0 = chạy chữ thuần) — trả về trong meta để
  // kiểm chứng được, vì log server không xem được từ ngoài.
  let visionCount = 0;
  // AI-10: độ phủ khối (total/covered/missing) — null khi tài liệu không cắt được khối nào.
  let blocksMeta: { total: number; covered: number; missing: number[] } | null = null;
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
              provider: mode === "parse" ? "rule" : "gemini",
              status: "running",
              model: mode === "parse" ? "rule:PARSE-1" : geminiModel,
              prompt: prompt ? prompt.slice(0, 2000) : null,
            },
          });
          aiLogId = log.id;
        } catch {}
        let resultText = "";
        let source: "docx" | "pdf-text" | "pdf-gemini" | "text" | "generate" | "smart" | "parse" = "text";
        // AI-8: engine nào phục vụ (để debug outage + hiện trong meta).
        let llmProvider: "gemini" | "groq" | "rule" = "gemini";

        const readDocument = async (target: File): Promise<{ text: string; key: DocxKey[] }> => {
          const buffer = Buffer.from(await target.arrayBuffer());
          if (!buffer.byteLength) return { text: "", key: [] };
          const lowerName = target.name.toLowerCase();
          // AI-9: đọc docx giữ màu đáp án + số mũ (mammoth bỏ cả hai).
          if (lowerName.endsWith(".docx")) {
            const rich = extractDocxText(buffer);
            if (rich.marked > 0) console.info(`[exam-docx] ${rich.marked} đáp án tô màu, ${rich.paragraphs} đoạn`);
            const text = rich.text.trim();
            if (text) return { text, key: rich.key };
            return { text: (await mammoth.extractRawText({ buffer })).value.trim(), key: [] };
          }
          const parsed = await extractPdfText(buffer);
          if (parsed) return { text: parsed, key: [] };
          return { text: (await target.text()).trim(), key: [] };
        };

        if (mode === "smart") {
          send({ type: "stage", stage: "extract" });
          let content = "";
          let detected: "docx" | "pdf-text" | "pdf-gemini" | "text" = "text";
          // AI-9: key đáp án tô màu (dùng ở reconcile sau solve).
          let docKey: DocxKey[] = [];
          if (file) {
            const lowerName = file.name.toLowerCase();
            if (!lowerName.endsWith(".docx") && !lowerName.endsWith(".pdf") && !file.type.includes("text")) {
              return send({ type: "error", error: "Chỉ hỗ trợ file PDF, Word (.docx) hoặc văn bản thuần" });
            }
            const doc = await readDocument(file);
            content = doc.text;
            docKey = doc.key;
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
          const { payload, stats, coverage } = await withDocVision(
            file ? Buffer.from(await file.arrayBuffer()) : null,
            file?.name ?? "",
            async (images) => {
              visionCount = images.length;
              const r = await runSmartPipeline(
                content,
                options,
                (phase, done, total) =>
                  send({ type: "stage", stage: phase === "solve" ? "solve" : "analyze", meta: { done, total } }),
                images,
                forceGroq,
                docKey,
              );
              if (r.provider === "groq") llmProvider = "groq";
              return r;
            },
          );
          blocksMeta = coverage;
          if (coverage && coverage.missing.length) {
            console.warn(`[exam-blocks] vẫn thiếu khối sau chạy bù: ${coverage.missing.join(",")}`);
          }
          if (!payload.questions?.length) return send({ type: "error", error: "AI không tìm thấy câu hỏi nào trong tài liệu" });
          resultText = JSON.stringify(payload);
          source = "smart";
          smartStats = stats;
        } else if (mode === "parse") {
          // PARSE-1 — đọc đề thuần rule, KHÔNG gọi AI. PDF scan/không có lớp
          // chữ thì báo GV dùng nút "Đọc bằng AI" (mode smart) thay vì tự đoán.
          send({ type: "stage", stage: "extract" });
          let content = "";
          let docKey: DocxKey[] = [];
          if (file) {
            const lowerName = file.name.toLowerCase();
            if (!lowerName.endsWith(".docx") && !lowerName.endsWith(".pdf") && !file.type.includes("text")) {
              return send({ type: "error", error: "Chỉ hỗ trợ file PDF, Word (.docx) hoặc văn bản thuần" });
            }
            if (lowerName.endsWith(".docx")) {
              const buffer = Buffer.from(await file.arrayBuffer());
              const rich = extractDocxText(buffer);
              if (rich.marked > 0) console.info(`[exam-parse] ${rich.marked} đáp án tô màu, ${rich.paragraphs} đoạn`);
              content = rich.text.trim() || (await mammoth.extractRawText({ buffer })).value.trim();
              docKey = rich.key;
              docxImages = rich.images;
            } else if (lowerName.endsWith(".pdf")) {
              const pdf = await extractPdfLayoutText(Buffer.from(await file.arrayBuffer()));
              content = pdf.text.trim();
              console.info(`[exam-parse] pdf engine=${pdf.engine}; chars=${content.length}`);
              if (!content) {
                return send({
                  type: "error",
                  error: 'PDF này không có lớp chữ (có thể là bản scan). Hãy dùng nút "Đọc bằng AI", hoặc nhập lại đề bằng Word.',
                });
              }
            } else {
              content = (await file.text()).trim();
            }
          } else {
            content = prompt || "";
          }
          if (!content) return send({ type: "error", error: "Không đọc được nội dung tài liệu" });
          console.info(`[exam-parse] content=${content.length} chars; engine=rule`);
          send({ type: "stage", stage: "analyze" });
          let parsed: ReturnType<typeof parseExamText>;
          try {
            parsed = parseExamText(content.slice(0, MAX_TEXT_CHARS), { docKey, images: docxImages });
          } catch (error) {
            return send({ type: "error", error: mapError(error instanceof Error ? error.message : "Không nhận diện được câu hỏi nào") });
          }
          if (!parsed.payload.questions?.length) {
            return send({ type: "error", error: 'Không nhận diện được câu hỏi nào trong tài liệu. Hãy kiểm tra lại hoặc dùng nút "Đọc bằng AI".' });
          }
          resultText = JSON.stringify(parsed.payload);
          source = "parse";
          parseIssues = parsed.issues.length ? parsed.issues : null;
          smartStats = computeStats(parsed.payload, 0);
          llmProvider = "rule";
        } else if (mode === "generate") {
          let content = "";
          let genBuffer: Buffer | null = null;
          if (file) {
            const buffer = Buffer.from(await file.arrayBuffer());
            genBuffer = buffer;
            const lowerName = file.name.toLowerCase();
            if (lowerName.endsWith(".docx")) {
              send({ type: "stage", stage: "extract" });
              const rich = extractDocxText(buffer);
              if (rich.marked > 0) console.info(`[exam-docx] ${rich.marked} đáp án tô màu`);
              content = rich.text.trim() || (await mammoth.extractRawText({ buffer })).value.trim();
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
          const gen = await withDocVision(genBuffer, file?.name ?? "", async (images) => {
            visionCount = images.length;
            const r = await runGenerate(content, options, (done, total) =>
              send({ type: "stage", stage: "analyze", meta: { done, total } }),
              images,
              forceGroq,
            );
            if (r.provider === "groq") llmProvider = "groq";
            return r.payload;
          });
          const payload = gen;
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
            const rich = extractDocxText(buffer);
            if (rich.marked > 0) console.info(`[exam-docx] ${rich.marked} đáp án tô màu`);
            const docx = rich.text.trim() ? { value: rich.text } : await mammoth.extractRawText({ buffer });
            const content = docx.value.trim();
            if (!content) return send({ type: "error", error: "Không đọc được nội dung trong file Word" });
            console.info(`[exam-import] docx extracted ${content.length} chars; model=${geminiModel}`);
            send({ type: "stage", stage: "analyze" });
            const result = await withDocVision(buffer, file.name, async (images) => {
              visionCount = images.length;
              const r = await generateTextWithFallback(
                `${extractionPrompt}\n\nNỘI DUNG ĐỀ:\n${content.slice(0, MAX_TEXT_CHARS)}`,
                images,
                { ...retryOpts, forceGroq },
              );
              if (r.provider === "groq") llmProvider = "groq";
              return r.text;
            });
            resultText = result;
            source = "docx";
          } else {
            const extractedText = await extractPdfText(buffer);
            if (extractedText) {
              console.info(`[exam-import] pdf text extracted ${extractedText.length} chars; model=${geminiModel}`);
              send({ type: "stage", stage: "analyze" });
              const result = await withDocVision(buffer, file.name, async (images) => {
                visionCount = images.length;
                const r = await generateTextWithFallback(
                  `${extractionPrompt}\n\nNỘI DUNG PDF:\n${extractedText}`,
                  images,
                  { ...retryOpts, forceGroq },
                );
                if (r.provider === "groq") llmProvider = "groq";
                return r.text;
              });
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
          const r = await generateTextWithFallback(
            `${extractionPrompt}\n\nNỘI DUNG:\n${prompt!}`,
            [],
            { ...retryOpts, forceGroq },
          );
          if (r.provider === "groq") llmProvider = "groq";
          resultText = r.text;
        }

        if (!resultText?.trim()) return send({ type: "error", error: "AI không trả về dữ liệu câu hỏi" });

        send({ type: "stage", stage: "check" });
        const elapsedMs = Date.now() - startedAt;
        console.info(`[exam-import] completed in ${elapsedMs}ms; model=${geminiModel}; provider=${llmProvider}; source=${source}; smart=${JSON.stringify(smartStats)}`);
        const smartMeta = smartStats ? { smart: smartStats } : {};
        const parseMeta = parseIssues?.length ? { parseIssues } : {};
        send({ type: "result", result: resultText, meta: { model: llmProvider === "rule" ? "rule:PARSE-1" : llmProvider === "groq" ? `groq:${process.env.GROQ_MODEL || "openai/gpt-oss-120b"}` : geminiModel, provider: llmProvider, source, elapsedMs, ...(visionCount ? { vision: visionCount } : {}), ...(blocksMeta ? { blocks: blocksMeta } : {}), ...smartMeta, ...parseMeta } });
        if (aiLogId) {
          await prisma.aiImportLog.update({
            where: { id: aiLogId },
            data: { status: "success", meta: { source, elapsedMs, ...smartMeta, ...parseMeta } },
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
        // AI-6f — dọn file tạm trên kho, xong hay lỗi cũng xoá để khỏi rác.
        if (tempPath) {
          await supabaseAdmin.storage.from(BUCKET).remove([tempPath]).catch(() => {});
        }
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
