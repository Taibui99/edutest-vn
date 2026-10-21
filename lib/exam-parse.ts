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
const EXPL_RE = /^(?:giải\s*thích|lời\s*giải)\s*[:\-–—]\s*(.*)$/i;
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

function isTfTokens(raw: string): boolean {
  const parts = raw
    .split(/[,;/]/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return parts.length >= 2 && parts.every((p) => p === "đúng" || p === "sai" || p === "dung");
}

function tfTokens(raw: string): boolean[] {
  return raw.split(/[,;/]/).map((p) => ["đúng", "dung"].includes(p.trim().toLowerCase()));
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
});

/** Gộp 1 dòng lựa chọn vào seg (hỗ trợ nhiều đáp án chung dòng). */
function pushOptionLine(seg: Seg, line: string) {
  for (const p of splitOptionLine(line)) {
    const om = /^([A-Da-d])[.)]\s*(.*)$/.exec(p);
    seg.options.push({ text: (om ? om[2] : p).trim() });
  }
}

function finalize(seg: Seg, issues: ParseIssue[]): SmartQuestion | null {
  const stem = clean(seg.stem.join(" "));
  if (!stem && seg.options.length === 0) return null;

  const label = seg.number != null ? `Câu ${seg.number}` : "Một khối";
  if (!stem && seg.options.length) {
    issues.push({ question: seg.number, message: `${label}: có các lựa chọn nhưng thiếu nội dung câu hỏi` });
  }

  const numStatements = seg.stem.filter((l) => BARENUM_RE.test(l)).length;
  let type: string;
  if (seg.options.length >= 2) type = "mcq";
  else if (seg.answerRaw && isTfTokens(seg.answerRaw) && numStatements >= 2) type = "true_false";
  else if (seg.answerRaw) type = "short_answer";
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
    if (type === "true_false" && seg.answerRaw) {
      const tokens = tfTokens(seg.answerRaw);
      const statements = seg.stem
        .filter((l) => BARENUM_RE.test(l))
        .map((l) => clean(l.replace(BARENUM_RE, "$2")));
      if (tokens.length === statements.length) {
        grading = { statements: statements.map((text, i) => ({ text, answer: tokens[i] })) };
      } else {
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
 * Đọc đề từ chữ đã bóc (DOCX/PDF text/dán) thành payload đúng khung SmartPayload
 * để màn review dùng lại y hệt. Ném lỗi khi không nhận diện được câu nào.
 */
export function parseExamText(
  raw: string,
  opts: { docKey?: DocxKey[]; images?: number; equations?: number; legacyEquations?: number } = {},
): ParseExamResult {
  const issues: ParseIssue[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const segs: Seg[] = [];
  const preamble: string[] = [];
  let cur: Seg | null = null;
  const push = () => {
    if (cur) {
      segs.push(cur);
      cur = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const { line: marked, letter } = extractMarker(lines[i]);
    let rest = marked;
    const qm = QNUM_RE.exec(marked);
    if (qm) {
      push();
      cur = newSeg(Number(qm[1]));
      if (qm[2]) cur.points = toPoints(qm[2]);
      rest = qm[3];
    } else {
      const bm = BARENUM_RE.exec(marked);
      // Dòng số trần chỉ mở câu mới khi đang ở đầu khối hoặc khối đã có
      // lựa chọn/đáp án. Mệnh đề Đúng/Sai đánh số trong câu KHÔNG mở câu mới.
      if (bm && (!cur || cur.options.length > 0 || cur.answerSeen)) {
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
