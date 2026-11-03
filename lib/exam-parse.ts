/**
 * PARSE-1 — bộ đọc đề thuần XÁC ĐỊNH (không AI).
 *
 * Mục tiêu: chính xác tuyệt đối trên tài liệu theo định dạng chuẩn — máy chỉ
 * trả về đúng những gì có trong file, KHÔNG bịa, KHÔNG đoán. Chỗ nào không
 * rõ thì gắn needsReview + issue để giáo viên sửa tay (hoặc bấm "AI giải
 * giúp" riêng cho câu thiếu đáp án).
 *
 * Định dạng đọc được:
 *   - Câu hỏi: "Câu 1:", "Câu hỏi 2.", đánh số trần "1. ..." / "1) ..."
 *     (dòng kế tiếp phải là lựa chọn hoặc câu hỏi có "?").
 *   - Lựa chọn: "A. ..." (A–D, chung dòng hoặc rời).
 *   - Đáp án: "Đáp án: B", marker tô màu "[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]"
 *     (do extractDocxText chèn), bảng đáp án cuối bài ("ĐÁP ÁN: 1.B 2.C").
 *   - Điểm: "(2đ)", "[0.5 điểm]", dòng "Điểm: 2".
 *   - Đúng/Sai: stem liệt kê mệnh đề đánh số + "Đáp án: Đúng, Sai, ...".
 *   - Đề không đánh số → fallback segmentQuestions (máy cắt khối).
 *
 * Thuần hàm, không IO — test bằng `node scripts/qa-exam-parse.mjs`.
 */

/* Dùng import tương đối kèm đuôi .ts (không phải "@/lib") để
 * `node scripts/qa-exam-parse.mjs` chạy thẳng file TS này không cần loader. */
import { isOptionLine, segmentQuestions, splitOptionLine } from "./exam-segment.ts";
import { detectAnswerKey, extractTablePairs, normalizeMcqAnswer, type SmartPayload, type SmartQuestion } from "./ai-exam-build.ts";
import { reconcileDocKey, type DocxKey } from "./exam-docx.ts";

export const ANSWER_MARK = "[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]";

export type ParseIssue = { question: number | null; message: string };

export type ParseExamResult = { payload: SmartPayload; issues: ParseIssue[] };

const QNUM_RE =
  /^(?:câu\s*(?:hỏi\s*(?:số\s*)?|số\s*|đề\s*câu\s*)?|bài\s*(?:tập\s*)?|question\s*|q\s*\.?\s*|problem\s*|exercise\s*|task\s*)(\d{1,3})\s*(?:\(\s*(\d+(?:[.,]\d+)?)\s*(?:đ|điểm|pts?|points?|marks?)\s*\)|\([^)]*\))?\s*[:.\-–—)/]\s*(.*)$/i;
const BARENUM_RE = /^(\d{1,3})\s*[.)]\s+(\S.*)$/;
const ANSWER_RE =
  /^(?:đáp\s*án(?:\s*(?:đúng|chuẩn|chi\s*tiết))?|dap\s*an|đ\/a|đa|kq|kết\s*quả|correct\s*answers?|answers?|ans\.?|key)\s*[:\-–—]\s*(.*)$/i;
/** Đáp án MCQ kiểu đề 2025: dòng riêng "Chọn D" / "Chọn B". */
const CHOSEN_RE =
  /^(?:chọn(?:\s*(?:đáp\s*án|câu))?|lựa\s*chọn|chon|choose)\s*[:.\-–—]?\s*([A-Fa-f])\s*[.)]?\s*$/i;
/** Mệnh đề Đúng/Sai 2025: "a) …", "b) …", "c) …", "d) …" (chữ thường để KHÔNG
 *  đụng lựa chọn MCQ "A. …" viết hoa). */
const STATEMENT_RE = /^\s*([a-d])\s*[.)]\s*(\S.*)$/;
const EXPL_RE =
  /^(?:giải\s*thích|lời\s*giải|hướng\s*dẫn\s*giải|hd\s*giải|hd|explanations?|expl\.?|solutions?)\s*[:\-–—]?\s*(.*)$/i;
const POINTS_LINE_RE = /^(?:điểm|diem|points?|pts?|marks?)\s*[:\-–—]\s*(\d+(?:[.,]\d+)?)\s*$/i;
const POINTS_TAIL_RE = /[\s([{]*(\d+(?:[.,]\d+)?)\s*(?:đ|điểm|pts?|points?|marks?)\s*[\])]?\s*$/i;
const SINGLE_TOKEN_RE = /^\s*([A-Fa-f]|[1-9])\s*[.,]?\s*$/;
/** Tham chiếu hình/biểu đồ — chế độ đọc theo quy tắc KHÔNG thấy hình nên
 *  đáp án có thể phụ thuộc hình. BỎ "hình học"/"hình tam giác" (từ vựng
 *  hình học thuần túy, không cần hình vẽ): chỉ flag "hình N", "hình vẽ",
 *  "hình dưới đây", "dựa vào hình", "biểu đồ", "sơ đồ", "đồ thị", "diagram", "figure", "picture". */
const FIGURE_REF_RE =
  /\bhình\s*(?:\d{1,2}|[IVXLC]{1,4}|vẽ|minh\s*họa|(?:dưới|trên|sau|bên|này)\s*(?:đây|là|làm|phía)?|trong\s*(?:bài|đề))\b|\bdựa\s*vào\s*(?:hình|biểu\s*đồ)\b|\bbiểu\s*đồ\b|\bsơ\s*đồ\b|\bđồ\s*thị\b|\b(?:figures?|diagrams?|charts?|graphs?|illustrations?|pictures?)\s*(?:\d{1,2}|[IVXLC]{1,4}|below|above)?\b|\b(?:refer\s*to\s*the\s*(?:figure|picture|diagram|chart|graph))\b/iu;

function toPoints(raw: string): number | null {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

const clean = (s: string) => s.split(ANSWER_MARK).join(" ").replace(/\s{2,}/g, " ").trim();

/** Ghép các dòng thân câu: hàng bảng "| … |" giữ XUỐNG DÒNG để UI render
 *  thành bảng thật (không cần ảnh); chữ thường vẫn ghép bằng khoảng trắng. */
function joinStemLines(lines: string[]): string {
  let out = "";
  for (const line of lines) {
    if (!out) {
      out = line;
      continue;
    }
    const tableRow = /^\|.*\|$/.test(line.trim());
    const prevTableRow = /\|\s*$/.test(out);
    out += tableRow || prevTableRow ? `\n${line}` : ` ${line}`;
  }
  return out;
}

/** Gỡ marker tô màu/highlight/gạch chân; phát hiện chữ cái lựa chọn mang
 *  marker (`marked` = dòng có đánh dấu đáp án, kể cả mệnh đề Đúng/Sai). */
function extractMarker(line: string): { line: string; letter: string | null; marked: boolean } {
  const marked = line.includes(ANSWER_MARK);
  if (!marked) return { line, letter: null, marked: false };
  let letter: string | null = null;
  for (const seg of splitOptionLine(line)) {
    if (!seg.includes(ANSWER_MARK)) continue;
    // CHỈ chữ hoa A–D: "a)" là mệnh đề Đúng/Sai, không phải lựa chọn MCQ.
    const m = /^([A-D])[.)]/.exec(seg);
    letter = m ? m[1] : null;
    break;
  }
  return { line: clean(line), letter, marked };
}

/** Token Đúng/Sai: "Đúng, Sai, Đúng" hoặc ngắn "Đ – S – Đ – S" (đề 2025). */
function tfTokenList(raw: string): (boolean | null)[] {
  return raw
    .split(/[,;/–—\-]|\s{1,}|\s*\.\s*/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .map((p) => {
      if (p === "đúng" || p === "dung" || p === "đ" || p === "t" || p === "true") return true;
      if (p === "sai" || p === "s" || p === "f" || p === "false") return false;
      return null;
    });
}

function isTfTokens(raw: string): boolean {
  const parts = tfTokenList(raw);
  return parts.length >= 2 && parts.every((p) => p !== null);
}

/**
 * Trích xuất đáp án Đúng/Sai nếu được ghi trực tiếp trên dòng mệnh đề:
 *  - Cuối câu: "... (đúng)", "... (sai)", "... [Đúng]", "... - Đúng", "... : Đúng"
 *  - Đầu câu: "[Đ] ...", "(Đúng) ..."
 * Trả về nội dung sạch (đã gỡ nhãn đáp án) và boolean đáp án (hoặc null nếu không có).
 */
function extractStatementAnswer(rawText: string): { text: string; answer: boolean | null } {
  let text = rawText.trim();
  let answer: boolean | null = null;

  // 1. Dò ở cuối câu: "(đúng)", "(sai)", "[Đúng]", " - Đúng", ": Đúng", "(đ)", "(s)"
  const tailRe = /(?:[\s([{–—\-:]|\b)(đúng|dung|sai|true|false|đ|s)[\s)\]}]*$/i;
  const tm = tailRe.exec(text);
  if (tm) {
    const val = tm[1].toLowerCase();
    if (val === "đúng" || val === "dung" || val === "đ" || val === "t" || val === "true") answer = true;
    else if (val === "sai" || val === "s" || val === "f" || val === "false") answer = false;
    if (answer !== null) {
      text = text.slice(0, tm.index).trim().replace(/[\s([{–—\-:]+$/, "").trim();
    }
  }

  // 2. Dò ở đầu câu: "[Đ] Nội dung", "(Đúng) Nội dung"
  if (answer === null) {
    const headRe = /^[\[(](đúng|dung|sai|true|false|đ|s)[\])]\s*[:.\-–—]?\s*(.*)$/i;
    const hm = headRe.exec(text);
    if (hm) {
      const val = hm[1].toLowerCase();
      if (val === "đúng" || val === "dung" || val === "đ" || val === "t" || val === "true") answer = true;
      else if (val === "sai" || val === "s" || val === "f" || val === "false") answer = false;
      if (answer !== null) {
        text = hm[2].trim();
      }
    }
  }

  return { text, answer };
}

/** Các biến thể đáp án trả lời ngắn được chấp nhận (số có/không đơn vị, dấu
 *  thập phân kiểu Việt Nam và quốc tế). Server bắt buộc short_answer phải có
 *  `grading.acceptedAnswers` thì mới lưu đề được. */
function shortAnswerVariants(raw: string): string[] {
  const base = raw.replace(/\s+/g, " ").trim();
  if (!base) return [];
  const set = new Set<string>([base]);
  const num = /^([−-]?\d[\d.,]*)/.exec(base)?.[1];
  if (num) {
    set.add(num);
    if (num.includes(",")) set.add(num.replace(/,/g, "."));
  }
  set.add(base.replace(/%/g, "").trim());
  return [...set].filter(Boolean);
}

type Seg = {
  number: number | null;
  stem: string[];
  options: { text: string }[];
  markerLetter: string | null;
  answerRaw: string | null;
  answerSeen: boolean;
  explanation: string[];
  /** Đã gặp mốc "Lời giải"/"Giải thích" → các dòng sau thuộc lời giải, không
   *  được gộp vào thân câu (nếu không câu hỏi bị lặp nội dung lời giải). */
  inExplanation: boolean;
  points: number | null;
  /** Mệnh đề Đúng/Sai dạng a) b) c) d) (đề 2025) — song song với answerRaw. */
  statements: string[];
  /** Đáp án từng mệnh đề suy ra từ gạch chân (đề chỉ gạch chân mệnh đề ĐÚNG). */
  statementAnswers: boolean[];
  /** Tiền tố nhãn của câu ("Câu", "Question", "Bài"). */
  labelPrefix?: string;
  /** Phần của đề (1 = trắc nghiệm, 2 = đúng/sai, 3 = trả lời ngắn, 4 = tự luận). */
  section: number;
};

const newSeg = (number: number | null, section = 1, labelPrefix = "Câu"): Seg => ({
  number,
  labelPrefix,
  stem: [],
  options: [],
  markerLetter: null,
  answerRaw: null,
  answerSeen: false,
  explanation: [],
  inExplanation: false,
  points: null,
  statements: [],
  statementAnswers: [],
  section,
});

/** Gộp 1 dòng lựa chọn vào seg (hỗ trợ nhiều đáp án chung dòng). */
function pushOptionLine(seg: Seg, line: string) {
  for (const p of splitOptionLine(line)) {
    const om = /^([A-Da-d])[.)]\s*(.*)$/.exec(p);
    // Bỏ dấu phân cách cuối (từ ô bảng nối "A. Jun ; B. Oát").
    const text = (om ? om[2] : p).trim().replace(/[\s;,]+$/, "").trim();
    seg.options.push({ text });
  }
}

function finalize(seg: Seg, issues: ParseIssue[]): SmartQuestion | null {
  const rawStem = clean(joinStemLines(seg.stem));
  if (!rawStem && seg.options.length === 0) return null;

  const label = seg.number != null ? `${seg.labelPrefix ?? "Câu"} ${seg.number}` : "Một khối";
  // Nếu câu không có stem nhưng có options (thường gặp ở đề tiếng Anh phát âm/trọng âm):
  // gán tiêu đề tự động để không bị rỗng
  const stem = rawStem || (seg.options.length ? (seg.number != null ? label : "Chọn đáp án đúng") : "");
  if (!rawStem && seg.options.length) {
    issues.push({ question: seg.number, message: `${label}: có các lựa chọn nhưng thiếu nội dung câu hỏi` });
  }

  const numStatements = seg.statements.length || seg.stem.filter((l) => BARENUM_RE.test(l)).length;
  let type: string;
  if (seg.options.length >= 2) type = "mcq";
  else if (isTfTokens(seg.answerRaw ?? "") && numStatements >= 2) type = "true_false";
  else if (seg.section >= 4) type = "essay";
  else if (seg.section >= 3) type = "short_answer";
  else if (seg.answerRaw) type = "short_answer";
  else if (numStatements >= 2) type = "true_false";
  else type = "essay";

  if (seg.options.length > 6) {
    issues.push({ question: seg.number, message: `${label}: có ${seg.options.length} lựa chọn, giữ 6 đầu tiên` });
  }
  const options = seg.options.slice(0, 6).map((o) => clean(o.text).replace(/^[A-Fa-f][.)]\s*/, "").trim());

  let answer = "";
  let answerSource: string | undefined;
  let needsReview = false;
  let grading: Record<string, unknown> | undefined;

  if (type === "mcq") {
    const fromLine = seg.answerRaw && SINGLE_TOKEN_RE.test(seg.answerRaw) ? seg.answerRaw : "";
    answer = normalizeMcqAnswer(seg.markerLetter ?? fromLine, options.length) ?? "";
    if (answer) {
      answerSource = "document";
    } else {
      answerSource = "unknown";
      needsReview = true;
      issues.push({
        question: seg.number,
        message: `${label}: không tìm thấy đáp án trong tài liệu — nhập tay hoặc bấm "AI giải giúp"`,
      });
    }
    if (seg.answerRaw && !seg.markerLetter && !fromLine) {
      issues.push({ question: seg.number, message: `${label}: đáp án ghi "${seg.answerRaw}" không phải 1 chữ cái A–D` });
    }
  } else {
    answer = clean(seg.answerRaw ?? "");
    if (answer) answerSource = "document";
    if (type === "true_false") {
      // Mệnh đề ưu tiên từ statements "a) b) c) d)" (đề 2025); nếu không có thì
      // lấy từ stem đánh số "1. 2. 3.".
      const statements = seg.statements.length
        ? seg.statements.map((s) => clean(s))
        : seg.stem
            .filter((l) => BARENUM_RE.test(l))
            .map((l) => clean(l.replace(BARENUM_RE, "$2")));
      const tokens = tfTokenList(seg.answerRaw ?? "").filter((x): x is boolean => x !== null);
      // 1. Đề ghi trực tiếp "(đúng)" / "(sai)" ở tất cả mệnh đề
      const allDirect =
        seg.statements.length >= 2 &&
        seg.statementAnswers.length === seg.statements.length &&
        seg.statementAnswers.every((x) => x !== null && x !== undefined);
      // 2. Đề chỉ gạch chân / tô màu mệnh đề ĐÚNG
      const fromUnderline =
        seg.statements.length >= 2 &&
        seg.statementAnswers.length === seg.statements.length &&
        seg.statementAnswers.some(Boolean);
      if (tokens.length === statements.length && statements.length >= 2) {
        grading = { statements: statements.map((text, i) => ({ text, answer: tokens[i] })) };
      } else if (allDirect) {
        grading = { statements: statements.map((text, i) => ({ text, answer: !!seg.statementAnswers[i] })) };
        answer = seg.statementAnswers.map((v) => (v ? "Đ" : "S")).join(" – ");
        answerSource = "document";
        needsReview = false;
      } else if (fromUnderline) {
        grading = { statements: statements.map((text, i) => ({ text, answer: !!seg.statementAnswers[i] })) };
        answer = seg.statementAnswers.map((v) => (v ? "Đ" : "S")).join(" – ");
        answerSource = "document";
        needsReview = false;
      } else if (statements.length >= 2) {
        issues.push({ question: seg.number, message: `${label}: số mệnh đề không khớp danh sách Đúng/Sai — kiểm tra tay` });
      }
    } else if (type === "short_answer") {
      if (answer) {
        grading = { acceptedAnswers: shortAnswerVariants(answer) };
      } else {
        needsReview = true;
        issues.push({
          question: seg.number,
          message: `${label}: chưa có đáp án trả lời ngắn trong tài liệu — nhập tay khi tạo đề`,
        });
      }
    }
  }

  // Câu tham chiếu hình/biểu đồ — parser không thấy hình → GV phải kiểm
  // tra đáp án có phụ thuộc hình không (đặt SAU khi đã có needsReview
  // từ nhánh đáp án để không ghi đè kết quả cũ).
  if (FIGURE_REF_RE.test(stem)) {
    needsReview = true;
    issues.push({
      question: seg.number,
      message: `${label}: tham chiếu hình/biểu đồ — đọc theo quy tắc không giữ hình, kiểm tra đáp án có phụ thuộc hình không`,
    });
  }

  return {
    index: 0,
    type,
    question: stem,
    options: type === "mcq" ? options : [],
    answer,
    points: seg.points ?? 1,
    grading,
    answerSource,
    needsReview,
    explanation: seg.explanation.join(" ").trim() || undefined,
  };
}

/**
 * Phân tích chuỗi đáp án Đúng/Sai dạng "a-Đ, b-S, c-Đ, d-S" hoặc "Đ – S – Đ – S"
 */
function parseTfAnswerString(raw: string): (boolean | null)[] {
  const subMatches = [...raw.matchAll(/[a-d]\s*[:\-–—]\s*([đdstf]|đúng|sai|true|false)/gi)];
  if (subMatches.length >= 2) {
    return subMatches.map((m) => {
      const val = m[1].toLowerCase();
      if (val === "đ" || val === "đúng" || val === "d" || val === "dung" || val === "t" || val === "true") return true;
      if (val === "s" || val === "sai" || val === "f" || val === "false") return false;
      return null;
    });
  }
  return tfTokenList(raw);
}

/**
 * Đọc "Bảng đáp án" cuối bài: hỗ trợ cả bảng ngang (| 1 | 2 | 3 |) lẫn bảng dọc (| Câu | Đáp án |).
 * Trả về map số-câu → đáp án. Bỏ qua ô không phải số câu.
 */
function parseAnswerTable(lines: string[]): Record<string, string> | null {
  const startIdx = lines.findIndex((l) =>
    /^(?:bảng\s*đáp\s*án|đáp\s*án|hướng\s*dẫn\s*chấm|answer\s*key|key)\b/i.test(l),
  );
  const relevantLines = startIdx >= 0 ? lines.slice(startIdx) : lines;
  const tableText = relevantLines.join("\n");
  const extracted = extractTablePairs(tableText);
  if (Object.keys(extracted).length > 0) return extracted;

  const out: Record<string, string> = {};
  const rows = relevantLines.filter((l) => /^\|.*\|$/.test(l.trim()));
  for (const row of rows) {
    const cells = row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.some((c) => /^(?:câu|question|q)$/i.test(c) || /^(?:đáp\s*án|đ\/a|answer|key)$/i.test(c))) continue;
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const n = cells[i].replace(/^(?:câu|question|q)\s*/i, "").trim();
      const a = cells[i + 1]?.trim() ?? "";
      if (/^\d{1,3}$/.test(n) && a) out[n] = a;
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Đọc đề từ chữ đã bóc (DOCX/PDF text/dán) thành payload đúng khung SmartPayload
 * để màn review dùng lại y hệt. Ném lỗi khi không nhận diện được câu nào.
 */
export function parseExamText(
  raw: string,
  opts: { docKey?: DocxKey[]; images?: number; equations?: number; legacyEquations?: number } = {},
): ParseExamResult {
  const issues: ParseIssue[] = [];
  // Dòng bảng "| ô | ô |" (từ DOCX):
  //  - Nếu ô chứa lựa chọn ("A. …"/"B. …") → tách mỗi ô 1 dòng để nhận diện
  //    đáp án (GV hay kẻ bảng cho các lựa chọn).
  //  - Nếu là bảng số liệu thuần (Năm/Sản lượng…) → GIỮ NGUYÊN dạng "| a | b |"
  //    để vẫn hiện trong câu hỏi và gắn ghi chú "dòng bảng số liệu".
  const expand = (l: string): string[] => {
    const t = l.trim();
    if (/^\|.*\|$/.test(t) && t.includes("|")) {
      const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const nonEmpty = cells.filter(Boolean);
      const hasOption = nonEmpty.some((c) => /(?<=[\s.,;:()"'$]|^)[A-D][\.\)\:](?=[\sA-Za-zÀ-ỹ]|$)/.test(c));
      if (hasOption) return nonEmpty;
      // Ô đơn chứa đầu câu hỏi ("Câu 2: …") → bỏ dấu "|" để nhận diện câu.
      if (nonEmpty.length === 1 && /^\s*(?:câu|bài)\s*\d/i.test(nonEmpty[0])) return nonEmpty;
      return [t];
    }
    return [t];
  };
  // Giữ thông tin "dòng này có dòng trống ngay trước không" — dùng để phân
  // biệt câu mới (đánh số trần, cách bởi dòng trống) với mệnh đề / lời giải
  // nằm liền trong cùng khối (tránh tách dư câu).
  const rawLines = raw.split(/\r?\n/);
  const lines: string[] = [];
  const blankBefore: boolean[] = [];
  let pendingBlank = false;
  for (const rl of rawLines) {
    if (!rl.trim()) {
      pendingBlank = true;
      continue;
    }
    for (const e of expand(rl)) {
      const v = e.trim();
      if (!v) continue;
      lines.push(v);
      blankBefore.push(pendingBlank);
      pendingBlank = false;
    }
  }

  const segs: Seg[] = [];
  const preamble: string[] = [];
  let cur: Seg | null = null;
  // Đề Thông tư 2025: Phần 1/2/3. Phần 1 đánh số "Câu N." trong text; Phần 2/3
  // đánh số bằng numbering tự động — exam-docx đã sinh tiền tố "Câu N." nên vẫn
  // chảy qua vòng lặp chính. `sectionRaw` giữ nguyên văn Phần 2/3 để đọc "Bảng
  // đáp án" cuối bài (đáp án trả lời ngắn).
  let section = 1;
  const sectionRaw: string[] = [];
  const push = () => {
    if (cur) {
      segs.push(cur);
      cur = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const { line: lineText, letter: rawLetter, marked: markedLine } = extractMarker(lines[i]);
    let letter = rawLetter;

    // Chuyển phần thi: "Phần 2." / "Phần 3." / "II. TRẮC NGHIỆM ĐÚNG - SAI" / "Part 1" / "Section A" / "2. Trắc nghiệm đúng sai" —
    // chốt câu đang dở (dòng tiêu đề KHÔNG được dính vào câu trước).
    const pm = /^(?:phần|part|section)\s*([1234])\b/i.exec(lineText);
    const rm =
      pm
        ? null
        : /^([IVX]+)\s*[.)]\s*(?:phần|part|section|trắc\s*nghiệm|tự\s*luận|trả\s*lời\s*ngắn|đúng\s*[-–—/]?\s*sai|multiple\s*choice|reading|writing|listening)\b/i.exec(
            lineText,
          );
    const sm =
      pm || rm
        ? null
        : /^([1234])\s*[.)]\s*(?:phần|part|section|trắc\s*nghiệm|tự\s*luận|trả\s*lời\s*ngắn|đúng\s*[-–—/]?\s*sai)\b/i.exec(
            lineText,
          );
    if (pm || rm || sm) {
      push();
      if (pm) section = Number(pm[1]);
      else if (rm?.[1] === "II") section = 2;
      else if (rm?.[1] === "III") section = 3;
      else if (rm?.[1] === "IV") section = 4;
      else if (sm) section = Number(sm[1]);
      continue;
    }
    if (section >= 2) sectionRaw.push(lineText);

    let rest = lineText;
    let opened = false;
    const qm = QNUM_RE.exec(lineText);
    if (qm) {
      push();
      const prefix = /^(?:question|q\b)/i.test(lineText) ? "Question" : /^bài/i.test(lineText) ? "Bài" : "Câu";
      cur = newSeg(Number(qm[1]), section, prefix);
      if (qm[2]) cur.points = toPoints(qm[2]);
      rest = qm[3];
      opened = true;
    } else {
      const bm = BARENUM_RE.exec(lineText);
      // Câu bị mất tiền tố trong đề thật (gõ "C." thay vì "Câu 7:") — dòng dài
      // có dấu hỏi ở phần trả lời ngắn vẫn phải mở câu mới, không được dính vào
      // lựa chọn của câu trước.
      const typo =
        section >= 3 && /^([A-D])[.)]\s+\S/.test(lineText) && /[?？]\s*$/.test(lineText) && lineText.length > 40;
      if (typo) {
        push();
        cur = newSeg(null, section);
        rest = lineText.replace(/^[A-D][.)]\s*/, "");
        opened = true;
        letter = null;
      } else if (bm) {
        // Dòng số trần mở câu mới khi:
        //  - đang ở đầu khối (!cur), HOẶC
        //  - cách dòng trước một DÒNG TRỐNG (blankBefore) → chắc chắn là câu mới
        //    (lời giải/bảng đáp án không có dòng trống ngay trước), HOẶC
        //  - khối đang có lựa chọn nhưng CHƯA thấy đáp án.
        // Sau khi đã có đáp án mà KHÔNG có dòng trống → là lời giải / bảng đáp án
        // ("1. …", "2. …") nên không mở câu mới (tránh tách dư câu).
        const canOpen = !cur || blankBefore[i] || (cur.options.length > 0 && !cur.answerSeen);
        if (canOpen) {
          const next = (lines[i + 1] ?? "").trim();
          // Phần tự luận: mỗi mục "1. Nêu …" là một câu, không cần dấu hỏi.
          const looksLikeQuestion =
            section >= 4 || /[?？]\s*$/.test(bm[2]) || isOptionLine(next) || splitOptionLine(next).length > 1;
          if (looksLikeQuestion) {
            push();
            cur = newSeg(Number(bm[1]), section);
            rest = bm[2];
            opened = true;
          }
        }
      }
    }
    if (!cur) {
      preamble.push(lineText);
      continue;
    }
    if (letter) cur.markerLetter = letter;
    // Mảnh "C)" / "C." rơi rớt trong đề (lỗi gõ) — bỏ qua, không đưa vào câu hỏi.
    if (/^[A-Da-d][.)]$/.test(rest)) continue;

    // Tự luận: dòng đầu là đề bài, các dòng sau là dàn ý/lời giải → explanation
    // (không hiển thị cho học sinh khi làm bài).
    if (cur.section >= 4 && !opened && rest) {
      cur.explanation.push(rest);
      continue;
    }

    // Trả lời ngắn: đề thật ghi phép tính/lời giải ngay dưới câu ("= 61,8 %").
    // Tách khỏi thân câu và lấy giá trị cuối cùng làm đáp án.
    if (cur.section === 3 && !opened && rest) {
      const asked = cur.stem.some((l) => /[?？]|bao nhiêu|hãy cho biết|tính/i.test(l));
      const isCalc = rest.includes("=") || (asked && (/^\(/.test(rest) || (/[/×]/.test(rest) && rest.length < 80)));
      if (asked && isCalc) {
        cur.explanation.push(rest);
        const value = /=\s*([−-]?\d[\d.,]*)/g;
        let last: string | null = null;
        let vm: RegExpExecArray | null;
        while ((vm = value.exec(rest)) !== null) last = vm[1];
        if (last && !cur.answerSeen) {
          cur.answerSeen = true;
          cur.answerRaw = last;
        }
        continue;
      }
    }

    const ans = ANSWER_RE.exec(rest);
    if (ans) {
      cur.answerSeen = true;
      cur.answerRaw = ans[1].trim();
      continue;
    }
    // Đề 2025: đáp án MCQ ghi kiểu "Chọn D" trên dòng riêng.
    const chosen = CHOSEN_RE.exec(rest);
    if (chosen) {
      cur.answerSeen = true;
      cur.answerRaw = chosen[1].toUpperCase();
      continue;
    }
    // Mệnh đề Đúng/Sai 2025: "a) …" "b) …" "c) …" "d) …". CHỈ nhận ở phần thân
    // câu (trước Lời giải / đáp án) — lời giải cũng có a) b) nhưng là diễn giải.
    const st = STATEMENT_RE.exec(rest);
    if (st && cur.options.length === 0 && !cur.answerSeen && cur.explanation.length === 0) {
      const parsedSt = extractStatementAnswer(st[2]);
      cur.statements.push(parsedSt.text);
      const stAns = parsedSt.answer !== null ? parsedSt.answer : markedLine ? true : null;
      cur.statementAnswers.push(stAns as unknown as boolean);
      continue;
    }
    const expl = EXPL_RE.exec(rest);
    if (expl) {
      cur.inExplanation = true;
      if (expl[1].trim()) cur.explanation.push(expl[1].trim());
      continue;
    }
    if (cur.inExplanation && rest) {
      cur.explanation.push(rest);
      continue;
    }
    // Mệnh đề Đúng/Sai có công thức nằm ở đoạn riêng ngay sau câu dẫn
    // ("c) Công thức … là:" rồi đoạn "$T_F=…$") — nối vào mệnh đề cuối thay vì
    // đẩy vào thân câu (trước đây công thức bị dính vào câu hỏi).
    if (cur.statements.length && cur.options.length === 0 && !cur.answerSeen && rest) {
      cur.statements[cur.statements.length - 1] = `${cur.statements[cur.statements.length - 1]} ${rest}`.trim();
      continue;
    }
    const pl = POINTS_LINE_RE.exec(rest);
    if (pl) {
      cur.points = toPoints(pl[1]);
      continue;
    }
    if (rest && isOptionLine(rest)) {
      pushOptionLine(cur, rest);
      continue;
    }
    // Dòng gộp "câu hỏi ... A. .. B. .. C. .. D. .." (GV hay dùng tab trong
    // Word): cắt phần lựa chọn ra khỏi câu hỏi để không nuốt hết vào stem.
    if (rest) {
      const inlineRe = /(?<=[\s.,;:()"'$]|^)([A-D])[\.\)\:](?=[\sA-Za-zÀ-ỹ]|$)/g;
      const marks: number[] = [];
      let im: RegExpExecArray | null;
      while ((im = inlineRe.exec(rest)) !== null) marks.push(im.index);
      // Cần ít nhất 2 lựa chọn VÀ phần lựa chọn đầu không nằm ở đầu dòng.
      if (marks.length >= 2 && marks[0] > 0) {
        const stemPart = rest.slice(0, marks[0]).trim();
        if (stemPart) cur.stem.push(stemPart);
        pushOptionLine(cur, rest.slice(marks[0]));
        continue;
      }
    }
    let s = rest;
    if (s && cur.points === null) {
      const pt = POINTS_TAIL_RE.exec(s);
      if (pt && pt.index > 0 && s.length - pt.index <= 8) {
        const val = toPoints(pt[1] ?? "");
        if (val !== null) {
          cur.points = val;
          s = s.slice(0, pt.index).trim();
        }
      }
    }
    if (s) cur.stem.push(s);
  }
  push();

  type Parsed = { q: SmartQuestion; number: number | null };
  const parsed: Parsed[] = [];
  for (const seg of segs) {
    const q = finalize(seg, issues);
    if (q) parsed.push({ q, number: seg.number });
  }

  // Đề Thông tư 2025 (Phần 2 Đúng/Sai, Phần 3 trả lời ngắn) đánh số bằng
  // numbering tự động của Word → exam-docx sinh sẵn tiền tố "Câu N." nên các
  // câu này đã vào `segs` như bình thường. Đáp án Phần 2 nằm ngay trong câu;
  // Phần 3 lấy từ "Bảng đáp án" cuối bài (theo thứ tự 1..n của phần).

  // Fallback: đề không đánh số → cắt theo dãy lựa chọn (exam-segment).
  // Lưu ý: segmentQuestions nuốt dòng "Đáp án: X" vào stem của câu KẾ TIẾP —
  // nên dòng đáp án trong stem sẽ được gán lại cho câu trước nếu câu trước
  // còn thiếu (file thật chạy theo kiểu này).
  if (parsed.length === 0) {
    const { blocks } = segmentQuestions(raw);
    for (const b of blocks) {
      const seg = newSeg(null);
      for (const opt of b.options) {
        let o = opt;
        if (o.includes(ANSWER_MARK)) {
          const m = /^([A-Da-d])[.)]/.exec(o);
          seg.markerLetter = m ? m[1].toUpperCase() : null;
          o = clean(o);
        }
        pushOptionLine(seg, /^\s*[A-Da-d][.)]/.test(o) ? o : `A. ${o}`);
      }
      let noteAns: string | null = null;
      for (const line of b.note.split(/\n/)) {
        const { line: marked, letter } = extractMarker(line);
        if (letter) seg.markerLetter = letter;
        const ans = ANSWER_RE.exec(marked);
        if (ans) {
          noteAns = ans[1].trim();
          continue;
        }
        const expl = EXPL_RE.exec(marked);
        if (expl) seg.explanation.push(expl[1].trim());
      }
      let stemAns: string | null = null;
      for (const line of b.stem.split(/\n/)) {
        const { line: marked, letter } = extractMarker(line);
        if (letter) seg.markerLetter = letter;
        const ans = ANSWER_RE.exec(marked);
        if (ans) {
          stemAns = ans[1].trim();
          continue;
        }
        if (marked) seg.stem.push(marked);
      }
      seg.answerRaw = noteAns;
      const q = finalize(seg, issues);
      if (q) parsed.push({ q, number: null });
      // Dòng đáp án lọt vào stem trên thực tế thuộc câu TRƯỚC.
      if (stemAns != null && parsed.length >= 2) {
        const prev = parsed[parsed.length - 2].q;
        if (prev.type === "mcq" && !prev.answer) {
          const norm = normalizeMcqAnswer(stemAns, prev.options.length);
          if (norm) {
            prev.answer = norm;
            prev.answerSource = "document";
            prev.needsReview = false;
          }
        } else if (q && q.type === "mcq" && !q.answer) {
          const norm = normalizeMcqAnswer(stemAns, q.options.length);
          if (norm) {
            q.answer = norm;
            q.answerSource = "document";
            q.needsReview = false;
          }
        }
      }
    }
    if (parsed.length) {
      issues.push({ question: null, message: "Tài liệu không đánh số câu hỏi — đọc theo khối lựa chọn" });
    }
  }

  if (parsed.length === 0) {
    throw new Error(
      'Không nhận diện được câu hỏi nào theo định dạng chuẩn (Câu 1 / A. B. C. D. / Đáp án:). Hãy dùng file theo mẫu, hoặc bấm "Đọc bằng AI" cho tài liệu lạ.',
    );
  }

  let questions = parsed.map((p, i) => ({ ...p.q, index: i }));

  // Bảng đáp án cuối bài (dạng lưới table hoặc danh sách) — điền cho các câu còn thiếu
  const fullTable = parseAnswerTable(lines) ?? parseAnswerTable(sectionRaw);
  const keyMap = detectAnswerKey(raw);

  // 1. Áp dụng cho Đúng/Sai
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.type !== "true_false" || q.answer) continue;
    const n = parsed[i].number;
    const rawTf = (n != null && fullTable ? fullTable[String(n)] : undefined) ?? (n != null && keyMap ? keyMap[String(n)] : undefined);
    if (rawTf) {
      const tokens = parseTfAnswerString(rawTf).filter((x): x is boolean => x !== null);
      const curGrading = (q.grading ?? {}) as { statements?: { text: string; answer?: boolean }[] };
      const statements = Array.isArray(curGrading.statements)
        ? curGrading.statements
        : segs[i]?.statements.map((t) => ({ text: t })) ?? [];
      if (tokens.length === statements.length && statements.length >= 2) {
        q.grading = { statements: statements.map((st, si) => ({ text: st.text, answer: tokens[si] })) };
        q.answer = tokens.map((v) => (v ? "Đ" : "S")).join(" – ");
        q.answerSource = "document";
        q.needsReview = false;
      }
    }
  }

  // 2. Áp dụng cho Trả lời ngắn / Tự luận
  if (fullTable) {
    const ordered = Object.keys(fullTable)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => fullTable[k]);
    let t = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.answer || (q.type !== "short_answer" && q.type !== "essay")) continue;
      const n = parsed[i].number;
      const ansByNum = n != null ? fullTable[String(n)] : undefined;
      const val = ansByNum || (t < ordered.length ? ordered[t++] : undefined);
      if (val && !/^[A-F]$/i.test(val)) {
        q.answer = val;
        q.type = "short_answer";
        q.answerSource = "document";
        q.needsReview = false;
      }
    }
  }

  // 3. Áp dụng cho Trắc nghiệm (MCQ)
  if (keyMap || fullTable) {
    const combinedKey: Record<string, string> = { ...(fullTable ?? {}), ...(keyMap ?? {}) };
    const keyCount = Object.keys(combinedKey).length;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.type !== "mcq" || q.answer) continue;
      const n = parsed[i].number;
      const letter =
        n != null ? combinedKey[String(n)] : keyCount === questions.length ? combinedKey[String(i + 1)] : undefined;
      const norm = normalizeMcqAnswer(letter, q.options.length);
      if (norm) {
        q.answer = norm;
        q.answerSource = "document";
        q.needsReview = false;
      }
    }
  }

  // Key tô màu trong Word thắng mọi suy đoán (khớp theo nội dung đáp án).
  const docKey = opts.docKey ?? [];
  if (docKey.length) {
    const rec = reconcileDocKey(questions, docKey);
    questions = rec.questions;
    if (rec.overridden > 0) {
      issues.push({ question: null, message: `${rec.overridden} đáp án lấy từ chữ tô màu trong Word` });
    }
  }

  // Server bắt buộc short_answer có `grading.acceptedAnswers` (đáp án điền từ
  // bảng đáp án / phép tính trên đề chưa có) — bổ sung sau khi đã ghép hết key.
  questions.forEach((q) => {
    if (q.type !== "short_answer" || !q.answer) return;
    const grading = (q.grading ?? {}) as { acceptedAnswers?: unknown };
    const accepted = Array.isArray(grading.acceptedAnswers) ? grading.acceptedAnswers : [];
    if (!accepted.length) {
      q.grading = { ...grading, acceptedAnswers: shortAnswerVariants(q.answer) };
    }
  });

  // PARSE-3 — câu/chỗ có công thức Word: ghi chú "nhập tay" + bật needsReview.
  const FORMULA_NOTE_RE = /\[CÔNG THỨC[^\]]*\]/;
  questions.forEach((q, qi) => {
    const parts = [q.question, ...(Array.isArray(q.options) ? q.options : [])];
    if (parts.some((t) => FORMULA_NOTE_RE.test(String(t ?? "")))) {
      q.needsReview = true;
      issues.push({
        question: qi + 1,
        message: `Câu ${qi + 1} có công thức — chỗ ghi "[CÔNG THỨC — nhập tay]" cần giáo viên gõ lại`,
      });
    }
  });

  // Ghi chú phần mềm (question: null) — dữ liệu bảng/hình ảnh trong tài liệu.
  const tableLines = raw.split("\n").filter((l) => /^\s*\|[^|].*\|\s*$/.test(l)).length;
  if (tableLines > 0) {
    issues.push({
      question: null,
      message: `Phát hiện ${tableLines} dòng bảng số liệu — dữ liệu được giữ trong câu hỏi, kiểm tra lại trình bày khi review`,
    });
  }
  const imageCount = opts.images ?? 0;
  if (imageCount > 0) {
    issues.push({
      question: null,
      message: `Tài liệu chứa ${imageCount} ảnh — đọc theo quy tắc không giữ ảnh, kiểm tra câu hỏi có phụ thuộc hình không`,
    });
  }
  const equationCount = opts.equations ?? 0;
  if (equationCount > 0) {
    issues.push({
      question: null,
      message: `Đã đọc ${equationCount} công thức trong tài liệu thành LaTeX — hiển thị trực tiếp trên web, kiểm tra lại khi duyệt`,
    });
  }
  const legacyCount = opts.legacyEquations ?? 0;
  if (legacyCount > 0) {
    issues.push({
      question: null,
      message: `Còn ${legacyCount} công thức MathType chưa giải mã được — đã chèn "[CÔNG THỨC — nhập tay]", giáo viên bổ sung khi duyệt`,
    });
  }

  const total = questions.length;
  const mcqCount = questions.filter((q) => q.type === "mcq").length;
  const fromDoc = questions.filter((q) => q.answerSource === "document").length;
  const titleLine = preamble.find((l) => l.length >= 4 && l.length <= 150 && /[A-Za-zÀ-ỹ]/.test(l));

  return {
    payload: {
      title: titleLine ?? "",
      kind: mcqCount * 2 > total ? "mcq" : "theory",
      answerKeyFound: !!keyMap || docKey.length > 0 || fromDoc > 0,
      answerKeyNote:
        docKey.length > 0
          ? "Đáp án lấy từ chữ tô màu trong file Word."
          : keyMap
            ? "Đáp án lấy từ bảng đáp án trong tài liệu."
            : fromDoc > 0
              ? "Đáp án ghi ngay trong từng câu."
              : "Tài liệu không có đáp án — cần nhập tay.",
      questions: questions.map((q, i) => ({ ...q, index: i })),
    },
    issues,
  };
}
