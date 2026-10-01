/**
 * Logic thuần cho pipeline "AI đọc tài liệu & tự dựng đề".
 * Tách riêng khỏi route để test được không cần Next/Gemini.
 */

export const DIFFICULTY_LEVELS = ["nhận biết", "thông hiểu", "vận dụng"] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

export type SmartQuestion = {
  index: number;
  type: string;
  question: string;
  options: string[];
  answer: string;
  grading?: Record<string, unknown>;
  explanation?: string;
  points?: number;
  difficulty?: string;
  answerSource?: string;
  confidence?: number;
  needsReview?: boolean;
  solveNote?: string;
};

export type SmartPayload = {
  title?: string;
  subject?: string;
  kind?: string;
  answerKeyFound?: boolean;
  answerKeyNote?: string;
  questions?: SmartQuestion[];
};

export type SmartStats = {
  total: number;
  fromDocument: number;
  aiSolved: number;
  agreed: number;
  tieBreak: number;
  needsReview: number;
  missingAnswer: number;
  kind: string;
  answerKeyFound: boolean;
};

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** Chuẩn hoá mọi biến thể độ khó AI trả về về đúng 3 mức của app. */
export function normalizeDifficulty(value: unknown): Difficulty | null {
  const v = norm(value);
  if (!v) return null;
  if (/vận dụng|van dung|apply|advanced|cao|tăng cường/.test(v)) return "vận dụng";
  if (/thông hiểu|thong hieu|comprehen|trung bình|medium/.test(v)) return "thông hiểu";
  if (/nhận biết|nhan biet|recogn|basic|dễ|de\b/.test(v)) return "nhận biết";
  return null;
}

/** Đáp án MCQ hợp lệ: A-F tuỳ số lựa chọn, hoặc 1-6 -> chữ cái. */
export function normalizeMcqAnswer(value: unknown, optionCount: number): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const letter = raw.charAt(0).toUpperCase();
  const max = Math.min(Math.max(optionCount, 4), 6);
  if (/[A-Fa-f]/.test(letter)) {
    const idx = letter.charCodeAt(0) - 65;
    return idx < max ? letter : null;
  }
  if (/^[1-9]$/.test(raw)) {
    const idx = Number(raw) - 1;
    return idx < max ? String.fromCharCode(65 + idx) : null;
  }
  return null;
}

// Chi kiem tra dang "so truoc, chu cai sau" (1.B, "Cau 3: B"). KHONG lay dang
// nguoc ("A. 1") vi se nham san phan liet chon A. 1  B. 2 cua chinh cau hoi.
const PAIR_RE = /(\d{1,3})\s*[\.\)]?\s*[:\.]?\s*([A-Fa-f])\b/g;

function collectPairs(line: string, into: Record<string, string>) {
  for (const m of line.matchAll(PAIR_RE)) {
    if (m[1]) into[String(Number(m[1]))] = m[2].toUpperCase();
  }
}

function countPairs(line: string) {
  return line.match(PAIR_RE)?.length ?? 0;
}

/**
 * Dò bảng đáp án trong tài liệu. Ưu tiên dòng có nhãn rõ ràng
 * ("ĐÁP ÂN: 1.B 2.C"), sau đó dòng dạng "Câu 1: A" / "1.A", cuối cùng
 * mới tới dòng gộp nhiều cặp (bảng, danh sách dọc). Bỏ qua dòng có dấu
 * hỏi để không nhầm phần đặt câu hỏi.
 */
export function detectAnswerKey(text: string): Record<string, string> | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const hasQuestionMark = (l: string) => /[?？]/.test(l);

  const labeled = lines.filter((l) => /(đáp\s*án|dap\s*an|answer\s*key)/i.test(l) && !hasQuestionMark(l));
  let map: Record<string, string> = {};
  for (const line of labeled) collectPairs(line, map);

  if (Object.keys(map).length < 2) {
    map = {};
    const numbered = lines.filter((l) => {
      const s = l.trim();
      if (!s || s.length > 120 || hasQuestionMark(s)) return false;
      return /^(câu\s*(hỏi\s*)?)?[\(\[]?\d{1,3}[\.\)]?\s*[:\.]?\s*[A-Fa-f]\b/i.test(s);
    });
    for (const line of numbered) collectPairs(line, map);
  }

  if (Object.keys(map).length < 2) {
    map = {};
    const compact = lines.filter((l) => {
      const s = l.trim();
      if (!s || s.length > 300 || hasQuestionMark(s)) return false;
      return countPairs(s) >= 2;
    });
    for (const line of compact) collectPairs(line, map);
  }

  // Bang dap an luon bat dau tu cau 1: dung moc nay de loai nhieu khoi dong
  // liet chon nham ve nhung chuc nang nham nhay nhu phan "A. 1  B. 2".
  const keys = Object.keys(map).map(Number);
  if (keys.length < 2 || Math.min(...keys) > 2) return null;
  return map;
}

/** Chuẩn hoá 1 câu từ payload AI, gán index theo thứ tự. */
export function normalizeQuestion(raw: Partial<SmartQuestion>, index: number): SmartQuestion {
  const type = ["mcq", "true_false", "short_answer", "essay"].includes(String(raw.type)) ? String(raw.type) : "mcq";
  const options = Array.isArray(raw.options) ? raw.options.map((o) => String(o).replace(/^\s*[A-Fa-f][\.\)]\s*/, "").trim()) : [];
  const answer = String(raw.answer ?? "").trim();
  return {
    index,
    type,
    question: String(raw.question ?? "").trim(),
    options: type === "mcq" ? (options.length >= 2 ? options.slice(0, 6) : ["", "", "", ""]) : options,
    answer: type === "mcq" ? normalizeMcqAnswer(answer, options.length) ?? "" : answer,
    grading: raw.grading && typeof raw.grading === "object" ? (raw.grading as Record<string, unknown>) : undefined,
    explanation: raw.explanation ? String(raw.explanation) : undefined,
    points: Number(raw.points) > 0 ? Number(raw.points) : 1,
    difficulty: raw.difficulty ? String(raw.difficulty) : undefined,
    answerSource: raw.answerSource ? String(raw.answerSource) : undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
    needsReview: raw.needsReview === true,
    solveNote: raw.solveNote ? String(raw.solveNote) : undefined,
  };
}

/** Ghép kết quả 2 lượt giải (self-consistency) + phá thế hoản. */
export function reconcileAnswers(
  questions: SmartQuestion[],
  votes: Map<number, { a?: string; b?: string; tie?: string }>,
): { questions: SmartQuestion[]; agreed: number } {
  const out = questions.map((q) => {
    const v = votes.get(q.index);
    if (!v) return q;
    const agreed = !!v.a && !!v.b && v.a === v.b;
    const final = agreed ? v.a! : v.tie || v.a || "";
    return {
      ...q,
      answer: final,
      answerSource: "ai",
      confidence: agreed ? 0.95 : v.tie ? 0.75 : 0.5,
      needsReview: !final || (!agreed && !v.tie),
      solveNote: agreed
        ? "2 lượt đồng thuận"
        : v.tie
          ? "Lượt 1 và 2 lệch nhau, đã phá thế hoản"
          : "Chưa chắc, cần giáo viên xem lại",
    };
  });
  return { questions: out, agreed: out.filter((q) => q.solveNote === "2 lượt đồng thuận").length };
}

/** Tính thống kê hiển thị trên màn hình review. */
export function computeStats(payload: SmartPayload, agreed?: number): SmartStats {
  const questions = (payload.questions ?? []).map((q, i) => normalizeQuestion(q, i));
  return {
    total: questions.length,
    fromDocument: questions.filter((q) => q.answerSource === "document").length,
    aiSolved: questions.filter((q) => q.answerSource === "ai").length,
    agreed: agreed ?? 0,
    tieBreak: questions.filter((q) => q.solveNote?.startsWith("Lượt 1 và 2")).length,
    needsReview: questions.filter((q) => q.needsReview).length,
    missingAnswer: questions.filter((q) => q.type === "mcq" && !q.answer).length,
    kind: String(payload.kind ?? ""),
    answerKeyFound: payload.answerKeyFound === true,
  };
}
