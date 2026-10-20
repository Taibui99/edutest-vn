/**
 * PARSE-2 — AI giám khảo đối chiếu (AI-as-judge) sau khi đọc rule.
 *
 * Triết lý: parser rule cho kết quả TẠO, AI chỉ ĐỐI CHIẾU với nguyên văn
 * và chỉ ra chỗ lệch — KHÔNG bao giờ tự sửa đáp án. Giáo viên xem findings
 * trong box ghi chú rồi quyết.
 *
 * Ba phần pure (test thuần bằng `node scripts/qa-ai-judge.mjs`):
 *  - buildJudgePrompt: soạn prompt nguyên văn + payload đã đọc.
 *  - parseJudgeFindings: đọc JSON trả về (tolerant: fence, rác quanh).
 *  - applyJudgeFindings: gắn needsReview + issue cho câu dính findings.
 * Phần async (judgeParsedExam) gọi Gemini trước, Groq dự phòng — lỗi thì
 * ném để route ghi nhận "chưa chạy được đối chiếu" (không chặn import).
 */
import { GoogleGenAI } from "@google/genai";
import { generateWithRetry } from "./ai.ts";
import { groqChatJson } from "./groq-import.ts";
import type { ParseIssue } from "./exam-parse.ts";
import type { SmartPayload } from "./ai-exam-build.ts";

const MAX_MODEL_OUTPUT = 16_384;
/** Giới hạn câu đưa vào đối chiếu — đề thi lớp phổ thông không vượt quá. */
export const JUDGE_MAX_QUESTIONS = 100;

/** Lazy — tránh khởi tạo client khi QA import module (node thuần không có key). */
let ai: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

export type JudgeFinding = { question: number | null; message: string };

/** Payload gọn chỉ gồm trường cần đối chiếu (bỏ explanation/grading nặng). */
function judgeView(payload: SmartPayload): unknown {
  const questions = (payload.questions ?? []).slice(0, JUDGE_MAX_QUESTIONS);
  return {
    title: payload.title ?? "",
    questions: questions.map((q, i) => ({
      n: i + 1,
      type: q.type,
      question: q.question,
      options: q.options,
      answer: q.answer,
      points: q.points ?? 1,
    })),
  };
}

export function buildJudgePrompt(source: string, payload: SmartPayload): string {
  return `Bạn là KIỂM TRA VIÊN đối chiếu đề thi. Dưới đây là NGUYÊN VĂN đề gốc do giáo viên soạn và JSON kết quả đọc TỰ ĐỘNG từ chính đề đó.

Nhiệm vụ: tìm khác biệt THỰC SỰ giữa JSON và nguyên văn:
1. Đáp án trong JSON khác với đáp án ghi trong nguyên văn (khi nguyên văn có ghi đáp án).
2. Câu hỏi hoặc lựa chọn bị mất ý, sai số liệu/đơn vị, lệch thứ tự so với nguyên văn.
3. Dữ liệu bảng/số bị đọc sai hoặc mất.
4. Câu trong JSON không có trong nguyên văn, hoặc câu có trong nguyên văn bị bỏ sót (chỉ báo khi rõ ràng).

KHÔNG: chấm điểm, gợi ý câu mới, nhận xét độ khó, nêu ý kiến cá nhân. Nếu JSON khớp nguyên văn thì "findings" là mảng rỗng.
Mỗi phát hiện: { "question": <số thứ tự câu trong JSON, bắt đầu từ 1; bỏ trống nếu lỗi toàn bài>, "issue": "<mô tả ngắn gọn, chỉ nêu fact>" }.
Trả về DUY NHẤT JSON: { "findings": [ ... ] }

=== NGUYÊN VĂN ===
${source.slice(0, 120_000)}

=== KẾT QUẢ ĐỌC TỰ ĐỘNG ===
${JSON.stringify(judgeView(payload))}`;
}

/** Rút JSON từ phản hồi AI (chấp nhận fence ```json + rác trước/sau). */
export function parseJudgeFindings(raw: string | null | undefined): JudgeFinding[] {
  const text = (raw || "").trim();
  if (!text) return [];
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = /\{[\s\S]*\}/.exec(cleaned);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
  const list = (parsed as { findings?: unknown })?.findings;
  if (!Array.isArray(list)) return [];
  const out: JudgeFinding[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const message = String((item as { issue?: unknown }).issue ?? "").trim();
    if (!message) continue;
    const qRaw = (item as { question?: unknown }).question;
    const qNum = typeof qRaw === "number" && Number.isFinite(qRaw) ? Math.floor(qRaw) : null;
    out.push({ question: qNum && qNum > 0 ? qNum : null, message: message.slice(0, 500) });
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * Gắn findings vào kết quả parse: câu dính lỗi → needsReview + issue riêng;
 * lỗi toàn bài → issue question:null. CHỈ thêm cờ, không sửa answer/options.
 * Trả về số câu bị đánh dấu (đếm distinct).
 */
export function applyJudgeFindings(
  payload: SmartPayload,
  issues: ParseIssue[],
  findings: JudgeFinding[],
): { flagged: number } {
  const questions = payload.questions ?? [];
  const seen = new Set<string>();
  const flagged = new Set<number>();
  for (const f of findings) {
    const dedupeKey = `${f.question ?? "doc"}::${f.message.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (f.question != null && f.question <= questions.length) {
      const q = questions[f.question - 1];
      q.needsReview = true;
      flagged.add(f.question - 1);
      issues.push({ question: f.question, message: `Câu ${f.question}: Đối chiếu phát hiện — ${f.message}` });
    } else {
      issues.push({ question: null, message: `Cả đề: Đối chiếu phát hiện — ${f.message}` });
    }
  }
  return { flagged: flagged.size };
}

const judgeSchema = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "number" },
          issue: { type: "string" },
        },
        required: ["issue"],
      },
    },
  },
  required: ["findings"],
};

function parseJson<U>(raw: string | null | undefined): U {
  const cleaned = (raw || "").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as U;
  } catch {
    throw new Error("AI giám khảo trả về JSON không hợp lệ");
  }
}

/** Gemini trước; 429/503/5xx hết attempts mới rơi Groq. Khác ai-solve: timeout ngắn hơn. */
async function judgeCall(prompt: string, forceGroq: boolean): Promise<{ raw: string; provider: "gemini" | "groq" }> {
  if (forceGroq) {
    return { raw: await groqChatJson(prompt, 60_000), provider: "groq" };
  }
  try {
    const raw = await generateWithRetry(
      (m) =>
        getAi().models.generateContent({
          model: m,
          contents: prompt,
          config: { responseMimeType: "application/json", responseSchema: judgeSchema, maxOutputTokens: MAX_MODEL_OUTPUT, temperature: 0 },
        }).then((r) => r.text),
      { attempts: 2, timeoutMs: 60_000 },
    );
    return { raw: raw ?? "", provider: "gemini" };
  } catch {
    console.warn("[ai-judge] Gemini sập, chuyển Groq dự phòng");
    return { raw: await groqChatJson(prompt, 60_000), provider: "groq" };
  }
}

/**
 * Chạy đối chiếu: thành công → { findings, provider } (findings=[] = khớp);
 * AI lỗi/không đọc được JSON → ném lỗi để route ghi nhận êm (không chặn import).
 */
export async function judgeParsedExam(
  source: string,
  payload: SmartPayload,
  forceGroq = false,
): Promise<{ findings: JudgeFinding[]; provider: "gemini" | "groq" }> {
  const { raw, provider } = await judgeCall(buildJudgePrompt(source, payload), forceGroq);
  parseJson<unknown>(raw); // ném sớm nếu hoàn toàn không phải JSON
  return { findings: parseJudgeFindings(raw), provider };
}
