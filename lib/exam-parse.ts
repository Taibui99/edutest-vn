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
import { detectAnswerKey, normalizeMcqAnswer, type SmartPayload, type SmartQuestion } from "./ai-exam-build.ts";
import { reconcileDocKey, type DocxKey } from "./exam-docx.ts";

export const ANSWER_MARK = "[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]";

export type ParseIssue = { question: number | null; message: string };

export type ParseExamResult = { payload: SmartPayload; issues: ParseIssue[] };

const QNUM_RE = /^câu\s*(?:hỏi\s*|đề\s*câu\s*)?(\d{1,3})\s*(?:\(\s*(\d+(?:[.,]\d+)?)\s*(?:đ|điểm)\s*\)|\([^)]*\))?\s*[:.\-–—)]\s*(.*)$/i;
const BARENUM_RE = /^(\d{1,3})\s*[.)]\s+(\S.*)$/;
const ANSWER_RE = /^(?:đáp\s*án(?:\s*đúng)?|dap\s*an)\s*[:\-–—]\s*(.*)$/i;
/** Đáp án MCQ kiểu đề 2025: dòng riêng "Chọn D" / "Chọn B". */
const CHOSEN_RE = /^(?:chọn|lựa\s*chọn|chon)\s*[:.\-–—]?\s*([A-Da-d])\s*[.)]?\s*$/i;
/** Mệnh đề Đúng/Sai 2025: "a) …", "b) …", "c) …", "d) …" (chữ thường để KHÔNG
 *  đụng lựa chọn MCQ "A. …" viết hoa). */
const STATEMENT_RE = /^\s*([a-d])\s*[.)]\s*(\S.*)$/;
const EXPL_RE = /^(?:giải\s*thích|lời\s*giải)\s*[:\-–—]?\s*(.*)$/i;
const POINTS_LINE_RE = /^(?:điểm|diem)\s*[:\-–—]\s*(\d+(?:[.,]\d+)?)\s*$/i;
const POINTS_TAIL_RE = /[\s([{]*(\d+(?:[.,]\d+)?)\s*(?:đ|điểm)\s*[\])]?\s*$/i;
const SINGLE_TOKEN_RE = /^\s*([A-Fa-f]|[1-9])\s*[.,]?\s*$/;
/** Tham chiếu hình/biểu đồ — chế độ đọc theo quy tắc KHÔNG thấy hình nên
 *  đáp án có thể phụ thuộc hình. BỎ "hình học"/"hình tam giác" (từ vựng
 *  hình học thuần túy, không cần hình vẽ): chỉ flag "hình N", "hình vẽ",
 *  "hình dưới đây", "dựa vào hình", "biểu đồ", "sơ đồ", "đồ thị". */
const FIGURE_REF_RE =
  /\bhình\s*(?:\d{1,2}|[IVXLC]{1,4}|vẽ|minh\s*họa|(?:dưới|trên|sau|bên|này)\s*(?:đây|là|làm|phía)?|trong\s*(?:bài|đề))\b|\bdựa\s*vào\s*(?:hình|biểu\s*đồ)\b|\bbiểu\s*đồ\b|\bsơ\s*đồ\b|\bđồ\s*thị\b/iu;

function toPoints(raw: string): number | null {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

const clean = (s: string) => s.split(ANSWER_MARK).join(" ").replace(/\s{2,}/g, " ").trim();

/** Gỡ marker tô màu; phát hiện chữ cái của lựa chọn mang marker. */
function extractMarker(line: string): { line: string; letter: string | null } {
  if (!line.includes(ANSWER_MARK)) return { line, letter: null };
  let letter: string | null = null;
  for (const seg of splitOptionLine(line)) {
    if (!seg.includes(ANSWER_MARK)) continue;
    const m = /^([A-Da-d])[.)]/.exec(seg);
    letter = m ? m[1].toUpperCase() : null;
    break;
  }
  return { line: clean(line), letter };
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

function tfTokens(raw: string): boolean[] {
  return tfTokenList(raw).map((p) => p === true);
}

type Seg = {
  number: number | null;
  stem: string[];
  options: { text: string }[];
  markerLetter: string | null;
  answerRaw: string | null;
  answerSeen: boolean;
  explanation: string[];
  points: number | null;
  /** Mệnh đề Đúng/Sai dạng a) b) c) d) (đề 2025) — song song với answerRaw. */
  statements: string[];
};

const newSeg = (number: number | null): Seg => ({
  number,
  stem: [],
  options: [],
  markerLetter: null,
  answerRaw: null,
  answerSeen: false,
  explanation: [],
  points: null,
  statements: [],
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
  const stem = clean(seg.stem.join(" "));
  if (!stem && seg.options.length === 0) return null;

  const label = seg.number != null ? `Câu ${seg.number}` : "Một khối";
  if (!stem && seg.options.length) {
    issues.push({ question: seg.number, message: `${label}: có các lựa chọn nhưng thiếu nội dung câu hỏi` });
  }

  const numStatements = seg.statements.length || seg.stem.filter((l) => BARENUM_RE.test(l)).length;
  let type: string;
  if (seg.options.length >= 2) type = "mcq";
  else if (isTfTokens(seg.answerRaw ?? "") && numStatements >= 2) type = "true_false";
  else if (seg.answerRaw) type = "short_answer";
  else if (numStatements >= 2) type = "true_false";
  else type = "essay";

  if (seg.options.length > 4) {
    issues.push({ question: seg.number, message: `${label}: có ${seg.options.length} lựa chọn, giữ 4 đầu tiên` });
  }
  const options = seg.options.slice(0, 4).map((o) => clean(o.text).replace(/^[A-Fa-f][.)]\s*/, "").trim());

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
      const tokens = tfTokens(seg.answerRaw ?? "");
      if (tokens.length === statements.length && statements.length >= 2) {
        grading = { statements: statements.map((text, i) => ({ text, answer: tokens[i] })) };
      } else if (statements.length >= 2) {
        issues.push({ question: seg.number, message: `${label}: số mệnh đề không khớp danh sách Đúng/Sai — kiểm tra tay` });
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
 * Đọc "Bảng đáp án" cuối bài dạng lưới "| Câu | Đáp án | Câu | Đáp án |" (đề
 * 2025). Trả về map số-câu → đáp án. Bỏ qua ô không phải số câu.
 */
function parseAnswerTable(lines: string[]): Record<string, string> | null {
  const start = lines.findIndex((l) => /^bảng\s*đáp\s*án\b/i.test(l));
  if (start < 0) return null;
  const out: Record<string, string> = {};
  const rows = lines.slice(start).filter((l) => /^\|.*\|$/.test(l.trim()));
  for (const row of rows) {
    const cells = row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    // header "Câu | Đáp án | Câu | Đáp án" → bỏ.
    if (cells.some((c) => /^câu$/i.test(c) || /^đáp\s*án$/i.test(c))) continue;
    // Ghép cặp (số câu, đáp án): cột 0↔1, cột 2↔3…
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const n = cells[i];
      const a = cells[i + 1];
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
      const hasOption = nonEmpty.some((c) => /(?<=[\s.,;:()"']|^)[A-D][\.\)\:](?=[\sA-Za-zÀ-ỹ]|$)/.test(c));
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
    const { line: marked, letter } = extractMarker(lines[i]);

    // Chuyển phần thi: "Phần 2." / "Phần 3." — chốt câu đang dở (Phần 1).
    const pm = /^phần\s*([123])\b/i.exec(marked);
    if (pm) {
      push();
      section = Number(pm[1]);
      continue;
    }
    if (section >= 2) sectionRaw.push(marked);

    let rest = marked;
    const qm = QNUM_RE.exec(marked);
    if (qm) {
      push();
      cur = newSeg(Number(qm[1]));
      if (qm[2]) cur.points = toPoints(qm[2]);
      rest = qm[3];
    } else {
      const bm = BARENUM_RE.exec(marked);
      // Dòng số trần mở câu mới khi:
      //  - đang ở đầu khối (!cur), HOẶC
      //  - cách dòng trước một DÒNG TRỐNG (blankBefore) → chắc chắn là câu mới
      //    (lời giải/bảng đáp án không có dòng trống ngay trước), HOẶC
      //  - khối đang có lựa chọn nhưng CHƯA thấy đáp án.
      // Sau khi đã có đáp án mà KHÔNG có dòng trống → là lời giải / bảng đáp án
      // ("1. …", "2. …") nên không mở câu mới (tránh tách dư câu).
      const canOpen = !cur || blankBefore[i] || (cur.options.length > 0 && !cur.answerSeen);
      if (bm && canOpen) {
        const next = (lines[i + 1] ?? "").trim();
        const looksLikeQuestion = /[?？]\s*$/.test(bm[2]) || isOptionLine(next) || splitOptionLine(next).length > 1;
        if (looksLikeQuestion) {
          push();
          cur = newSeg(Number(bm[1]));
          rest = bm[2];
        }
      }
    }
    if (!cur) {
      preamble.push(marked);
      continue;
    }
    if (letter) cur.markerLetter = letter;

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
      cur.statements.push(st[2].trim());
      continue;
    }
    const expl = EXPL_RE.exec(rest);
    if (expl) {
      cur.explanation.push(expl[1].trim());
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
      const inlineRe = /(?<=[\s.,;:()"']|^)([A-D])[\.\)\:](?=[\sA-Za-zÀ-ỹ]|$)/g;
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

  // "Bảng đáp án" cuối bài (đề 2025): { "1": "34", "2": "170", … } cho Phần 3
  // (trả lời ngắn). Áp theo THỨ TỰ cho các câu trả lời ngắn còn thiếu đáp án.
  const p3Table = parseAnswerTable(sectionRaw);
  if (p3Table) {
    const ordered = Object.keys(p3Table)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => p3Table[k]);
    let t = 0;
    for (const q of questions) {
      if (q.answer || (q.type !== "short_answer" && q.type !== "essay")) continue;
      if (t >= ordered.length) break;
      q.answer = ordered[t++];
      q.type = "short_answer";
      q.answerSource = "document";
      q.needsReview = false;
    }
  }

  // Bảng đáp án cuối bài — điền cho câu còn trống (theo số câu; nếu số câu
  // khớp đúng số dòng key thì áp dụng theo thứ tự cho câu không đánh số).
  const keyMap = detectAnswerKey(raw);
  if (keyMap) {
    const keyCount = Object.keys(keyMap).length;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.type !== "mcq" || q.answer) continue;
      const n = parsed[i].number;
      const letter = n != null ? keyMap[String(n)] : keyCount === questions.length ? keyMap[String(i + 1)] : undefined;
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
      message: `Đã đánh dấu ${equationCount} chỗ có công thức — chỗ đó ghi "[CÔNG THỨC — nhập tay]", giáo viên gõ lại công thức khi duyệt`,
    });
  }
  const legacyCount = opts.legacyEquations ?? 0;
  if (legacyCount > 0) {
    issues.push({
      question: null,
      message: `Tài liệu có ${legacyCount} công thức Equation Editor 3.0 (đời cũ, dạng nhị phân) — mở bằng Word 2016 trở lên rồi lưu lại để Word tự chuyển sang công thức mới, sau đó import lại`,
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
