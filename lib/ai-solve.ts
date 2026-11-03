/**
 * AI tự giải đáp án còn thiếu (2 lượt độc lập + phá thế hoản).
 * Tách khỏi route /api/gemini để (a) route nhẹ hơn và (b) modal import gọi
 * thẳng cho từng câu thiếu đáp án (nút "AI giải giúp") mà không chạy cả pipeline.
 */
import { GoogleGenAI } from "@google/genai";
import { generateWithRetry } from "@/lib/ai";
import { groqChatJson } from "@/lib/groq-import";
import { normalizeMcqAnswer, reconcileAnswers, type SmartQuestion } from "@/lib/ai-exam-build";

/* generateWithRetry tự xoay modelChain (EXAM_IMPORT_MODEL + lite dự phòng). */
const MAX_MODEL_OUTPUT = 24_576;
const SOLVE_BATCH = 8;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const solvePrompt = (items: { n: number; question: string; options: string[] }[], run: string) => `Bạn là chuyên gia giải đề trắc nghiệm Việt Nam. Lượt giải độc lập ${run}.

DANH SÁCH CÂU HỎI CẦN GIẢI:
${items
  .map(
    (it) => `[Câu ${it.n}]
${it.question}
${it.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}`,
  )
  .join("\n\n")}

QUY TRÌNH SUY LUẬN BẮT BUỘC (CHAIN-OF-THOUGHT):
Với MỖI câu hỏi:
1. Viết 1-2 câu suy luận/chứng minh (thought) phân tích bản chất, công thức hoặc loại trừ đáp án sai.
2. Từ suy luận trên, chốt đáp án đúng duy nhất ("A", "B", "C" hoặc "D").
3. Tự tin (confidence) từ 0.8 đến 1.0.

Trả về JSON:
{
  "answers": [
    {
      "n": <số thứ tự câu>,
      "thought": "<suy luận ngắn gọn>",
      "answer": "A|B|C|D",
      "confidence": 0.95
    }
  ]
}`;

const tieBreakPrompt = (q: { n: number; question: string; options: string[] }, cands: string[]) => `Hai lượt giải độc lập cho câu hỏi dưới đây đã cho hai đáp án khác nhau: ${cands.join(" và ")}.

Câu ${q.n}: ${q.question}
A. ${q.options[0] ?? ""}
B. ${q.options[1] ?? ""}
C. ${q.options[2] ?? ""}
D. ${q.options[3] ?? ""}

Hãy đóng vai trò Giám khảo phúc khảo tối cao:
1. Phân tích cặn kẽ từng lựa chọn, chỉ ra bẫy hoặc lỗi sai ở phương án sai.
2. Chứng minh vì sao phương án được chọn là đúng đắn và chuẩn xác nhất.
Trả về JSON: { "thought": "<lập luận chi tiết>", "answer": "A|B|C|D", "confidence": 0..1 }`;

const solveSchema = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "number" },
          thought: { type: "string" },
          answer: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["n", "thought", "answer"],
      },
    },
  },
  required: ["answers"],
};

const oneSchema = {
  type: "object",
  properties: {
    thought: { type: "string" },
    answer: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["thought", "answer"],
};

function parseJson<U>(raw: string | null | undefined): U {
  const cleaned = (raw || "").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as U;
  } catch {
    throw new Error("AI trả về dữ liệu giải đáp án không hợp lệ");
  }
}

/** Gemini trước; 429/503/5xx hoặc hết attempts mới rơi Groq (chữ thuần). */
async function solveCallJson<T>(
  prompt: string,
  schema: unknown,
  timeoutMs = 70_000,
  forceGroq = false,
  temperature = 0.2,
): Promise<{ data: T; provider: "gemini" | "groq" }> {
  if (forceGroq) {
    return { data: parseJson<T>(await groqChatJson(prompt, Math.min(timeoutMs, 60_000))), provider: "groq" };
  }
  try {
    const raw = await generateWithRetry(
      (m) =>
        ai.models.generateContent({
          model: m,
          contents: prompt,
          config: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: MAX_MODEL_OUTPUT, temperature },
        }).then((r) => r.text),
      { attempts: 2, timeoutMs },
    );
    return { data: parseJson<T>(raw), provider: "gemini" };
  } catch {
    console.warn("[ai-solve] Gemini sập, chuyển Groq dự phòng");
    const raw = await groqChatJson(prompt, Math.min(timeoutMs, 60_000));
    return { data: parseJson<T>(raw), provider: "groq" };
  }
}

/**
 * Tự làm đáp án khi tài liệu không có phần đáp án:
 * 2 lượt giải độc lập → đối chiếu → lệch nhau thì phá thế hoản (lượt 3).
 * Không chạy cho câu đã có đáp sẵn trong tài liệu.
 */
export async function solveMissingAnswers(
  questions: SmartQuestion[],
  onProgress?: (done: number, total: number) => void,
  forceGroq = false,
): Promise<{ questions: SmartQuestion[]; agreed: number; provider: "gemini" | "groq" }> {
  const todo = questions.filter((q) => q.type === "mcq" && !q.answer);
  if (todo.length === 0) return { questions, agreed: 0, provider: "gemini" };
  let provider: "gemini" | "groq" = "gemini";

  const votes = new Map<number, { a?: string; b?: string; tie?: string; thought?: string }>();
  const totalSteps = todo.length * 2;
  let step = 0;

  for (let i = 0; i < todo.length; i += SOLVE_BATCH) {
    const batch = todo.slice(i, i + SOLVE_BATCH).map((q, j) => ({ n: i + j + 1, question: q.question, options: q.options }));
    const [runA, runB] = await Promise.all([
      solveCallJson<{ answers: { n: number; thought?: string; answer: string }[] }>(solvePrompt(batch, "1"), solveSchema, 70_000, forceGroq, 0.2),
      solveCallJson<{ answers: { n: number; thought?: string; answer: string }[] }>(solvePrompt(batch, "2"), solveSchema, 70_000, forceGroq, 0.2),
    ]);
    if (runA.provider === "groq" || runB.provider === "groq") provider = "groq";
    const pick = (res: { answers?: { n: number; thought?: string; answer: string }[] }, n: number) => {
      const hit = res.answers?.find((x) => Number(x.n) === n);
      return hit ? { answer: normalizeMcqAnswer(hit.answer, 4) ?? undefined, thought: hit.thought } : undefined;
    };
    for (const item of batch) {
      const src = todo[item.n - 1];
      const a = pick(runA.data, item.n);
      const b = pick(runB.data, item.n);
      votes.set(src.index, { a: a?.answer, b: b?.answer, thought: a?.thought || b?.thought });
      step += 2;
      onProgress?.(Math.min(step, totalSteps), totalSteps);
    }
  }

  const conflicts = todo.filter((q) => {
    const v = votes.get(q.index);
    return v?.a && v?.b && v.a !== v.b;
  });
  console.info(`[ai-solve] giải tay ${todo.length} câu; ${votes.size - conflicts.length} đồng thuận; ${conflicts.length} cần phá thế hoản`);
  if (conflicts.length) {
    step = todo.length * 2;
    for (const q of conflicts) {
      try {
        const res = await solveCallJson<{ thought?: string; answer: string }>(
          tieBreakPrompt({ n: q.index + 1, question: q.question, options: q.options }, [votes.get(q.index)!.a!, votes.get(q.index)!.b!]),
          oneSchema,
          70_000,
          forceGroq,
          0.2,
        );
        if (res.provider === "groq") provider = "groq";
        votes.get(q.index)!.tie = normalizeMcqAnswer(res.data.answer, q.options.length) ?? undefined;
        if (res.data.thought) votes.get(q.index)!.thought = res.data.thought;
      } catch (error) {
        console.warn(`[ai-solve] phá thế hoản thất bại câu ${q.index + 1}`, error);
      }
      step += 1;
      onProgress?.(Math.min(step, totalSteps + conflicts.length), totalSteps + conflicts.length);
    }
  }

  const { questions: solved, agreed } = reconcileAnswers(questions, votes);
  const unanswered = solved.filter((q) => q.type === "mcq" && !q.answer).length;
  if (unanswered > 0) {
    console.warn(`[ai-solve] còn ${unanswered} câu không lấy được đáp án nào; đánh dấu cho giáo viên xem lại`);
  }
  return { questions: solved, agreed, provider };
}
