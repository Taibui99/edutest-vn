/**
 * Logic thuần cho pipeline "AI đọc tài liệu & tự dựng đề".
 * Tách riêng khỏi route để test được không cần Next/Gemini.
 */

export const DIFFICULTY_LEVELS = ["nhận biết", "thông hiểu", "vận dụng"] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

export type SmartQuestion = {
  index: number;
  type: string;
  /** AI-10: các số KHỐI đã dùng để dựng câu này (điểm danh độ phủ). */
  blocks_used?: number[];
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

// Kiểm tra dạng "số trước, chữ cái sau" (1.B, 1-B, 1/B, 1: B, 1B, "Câu 3: B", "Question 4: C").
// KHÔNG lấy dạng ngược ("A. 1") vì sẽ nhầm sang phần liệt chọn A. 1  B. 2 của chính câu hỏi.
const PAIR_RE = /(?:câu\s*(?:hỏi\s*)?|q\s*\.?\s*|question\s*)?(\d{1,3})\s*[\.\)\:\/\-–—]?\s*[:.\-–—]?\s*([A-Fa-f])\b/gi;

function collectPairs(line: string, into: Record<string, string>) {
  for (const m of line.matchAll(PAIR_RE)) {
    if (m[1] && m[2]) into[String(Number(m[1]))] = m[2].toUpperCase();
  }
}

function countPairs(line: string) {
  return line.match(PAIR_RE)?.length ?? 0;
}

/** Kiểm tra chuỗi có phải dạng đáp án hợp lệ trong bảng key không
 *  (để tránh nhầm lẫn bảng dữ liệu trong câu hỏi). */
function isLikelyAnswerText(ans: string): boolean {
  if (!ans || ans.length > 35 || /[?？]/.test(ans)) return false;
  if (/^(?:đáp\s*án|đ\/a|đa|answer|key|câu|question|thời\s*gian|sự\s*kiện|nội\s*dung|ý\s*nghĩa)$/i.test(ans)) return false;
  // Chữ cái đơn A-F
  if (/^[A-Fa-f][\.\)]?$/.test(ans)) return true;
  // Đúng/Sai token hoặc danh sách a-Đ, b-S
  if (/^(?:đúng|dung|sai|true|false|[đdstf])$/i.test(ans)) return true;
  if (/^[a-d]\s*[:\-–—]\s*[đdstf]/i.test(ans)) return true;
  if (/^[đdstf](\s*[-–—,/]\s*[đdstf])+$/i.test(ans)) return true;
  // Số hoặc số kèm đơn vị ngắn
  if (/^[−-]?\d+(?:[.,]\d+)?(?:\s*(?:%|m|s|kg|j|kj|n|mol|l|ml|cm|km|h|w|v|a))?$/i.test(ans)) return true;
  // Cặp số-chữ cái kiểu "1A"
  if (/^\d{1,3}[A-Fa-f]$/.test(ans)) return true;
  return false;
}

/**
 * Trích xuất các cặp (câu, đáp án) từ các bảng Markdown (| ô | ô |).
 * Hỗ trợ cả bảng ngang (hàng 1: câu 1..10, hàng 2: đáp án A..D)
 * lẫn bảng dọc (| Câu | Đáp án | Câu | Đáp án |).
 */
export function extractTablePairs(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!text || !text.includes("|")) return map;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^\|.*\|$/.test(l));
  if (lines.length === 0) return map;

  // 1. Dò bảng ngang: hàng 1 là số câu, hàng 2 liền kề là đáp án
  for (let r = 0; r + 1 < lines.length; r++) {
    const rowA = lines[r].replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    const rowB = lines[r + 1].replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (rowA.length !== rowB.length || rowA.length < 2) continue;

    let qCount = 0;
    for (let c = 0; c < rowA.length; c++) {
      const cleanNum = rowA[c].replace(/^(?:câu\s*(?:hỏi\s*)?|q\s*\.?\s*|question\s*)/i, "").trim();
      if (/^\d{1,3}$/.test(cleanNum)) qCount++;
    }

    if (qCount >= 2 && qCount >= rowA.length - 2) {
      for (let c = 0; c < rowA.length; c++) {
        const qNum = rowA[c].replace(/^(?:câu\s*(?:hỏi\s*)?|q\s*\.?\s*|question\s*)/i, "").trim();
        const ans = rowB[c].replace(/\[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU\]/g, "").trim();
        if (/^\d{1,3}$/.test(qNum) && isLikelyAnswerText(ans)) {
          map[qNum] = ans;
        }
      }
      r++; // Đã xử lý cặp hàng này
    }
  }

  // 2. Dò bảng dọc: | 1 | A | 2 | B | hoặc | Câu | Đáp án |
  for (const line of lines) {
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.some((c) => /^(?:câu|question|q)$/i.test(c) && /^(?:đáp\s*án|đ\/a|answer|key)$/i.test(cells[1] ?? ""))) continue;
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const qNum = cells[i].replace(/^(?:câu\s*(?:hỏi\s*)?|q\s*\.?\s*|question\s*)/i, "").trim();
      const ans = cells[i + 1]?.replace(/\[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU\]/g, "").trim() ?? "";
      if (/^\d{1,3}$/.test(qNum) && isLikelyAnswerText(ans)) {
        map[qNum] = ans;
      }
    }
  }

  return map;
}

/**
 * Dò bảng đáp án trong tài liệu. Ưu tiên bảng dữ liệu (Word/Markdown table),
 * sau đó dòng có nhãn rõ ràng ("ĐÁP ÁN: 1.B 2.C"), dòng dạng "Câu 1: A" / "1.A",
 * cuối cùng mới tới dòng gộp nhiều cặp. Bỏ qua dòng có dấu hỏi để không nhầm stem.
 */
export function detectAnswerKey(text: string): Record<string, string> | null {
  if (!text) return null;

  // Dò trước từ bảng dữ liệu (table)
  const tablePairs = extractTablePairs(text);

  const lines = text.split(/\r?\n/);
  const hasQuestionMark = (l: string) => /[?？]/.test(l);

  const labeled = lines.filter(
    (l) => /(đáp\s*án|dap\s*an|answer\s*key|key|hướng\s*dẫn\s*chấm)/i.test(l) && !hasQuestionMark(l),
  );
  let map: Record<string, string> = { ...tablePairs };
  for (const line of labeled) collectPairs(line, map);

  if (Object.keys(map).length < 2) {
    map = { ...tablePairs };
    const numbered = lines.filter((l) => {
      const s = l.trim();
      if (!s || s.length > 120 || hasQuestionMark(s)) return false;
      return /^(?:câu\s*(?:hỏi\s*)?|q\s*\.?\s*|question\s*)?[\(\[]?\d{1,3}[\.\)\:\/\-–—]?\s*[:.\-–—]?\s*[A-Fa-f]\b/i.test(s);
    });
    for (const line of numbered) collectPairs(line, map);
  }

  if (Object.keys(map).length < 2) {
    map = { ...tablePairs };
    const compact = lines.filter((l) => {
      const s = l.trim();
      if (!s || s.length > 300 || hasQuestionMark(s)) return false;
      return countPairs(s) >= 2;
    });
    for (const line of compact) collectPairs(line, map);
  }

  // Bảng đáp án luôn bắt đầu từ câu 1: dùng mốc này để loại các khối
  // đáp án dính nhầm vào số liệu trong bài
  const keys = Object.keys(map).map(Number);
  if (keys.length < 2 || Math.min(...keys) > 2) return null;
  return map;
}

/** Chuẩn hoá 1 câu từ payload AI, gán index theo thứ tự. */
export function normalizeQuestion(raw: Partial<SmartQuestion>, index: number): SmartQuestion {
  // AI-10: "skip" đi qua nguyên để server đếm độ phủ (không thành câu hỏi).
  const rawType = String(raw.type);
  const type = rawType === "skip" || ["mcq", "true_false", "short_answer", "essay"].includes(rawType) ? rawType : "mcq";
  const options = Array.isArray(raw.options) ? raw.options.map((o) => String(o).replace(/^\s*[A-Fa-f][\.\)]\s*/, "").trim()) : [];
  const answer = String(raw.answer ?? "").trim();
  return {
    index,
    type,
    blocks_used: Array.isArray(raw.blocks_used)
      ? raw.blocks_used.filter((n) => Number.isInteger(n))
      : undefined,
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
  votes: Map<number, { a?: string; b?: string; tie?: string; thought?: string }>,
): { questions: SmartQuestion[]; agreed: number } {
  const out = questions.map((q) => {
    const v = votes.get(q.index);
    if (!v) return q;
    const agreed = !!v.a && !!v.b && v.a === v.b;
    const final = agreed ? v.a! : v.tie || v.a || "";
    return {
      ...q,
      answer: final,
      explanation: q.explanation || v.thought || undefined,
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
