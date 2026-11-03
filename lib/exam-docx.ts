/**
 * AI-9 — đọc Word giữ lại thứ máy thường nuốt:
 *  1. ĐÁP ÁN TÔ MÀU: giáo viên hay tô màu đáp án đúng (thường ĐỎ). mammoth
 *     extractRawText bỏ màu → AI không thấy key → tự giải rồi lệch key.
 *     Ở đây phát hiện run màu ĐỎ trên đáp án (ở chữ cái HOẶC ở nội dung —
 *     file thật có cả 2 kiểu) và chèn marker `[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]`
 *     để model + heuristic cùng thấy.
 *  2. SỐ MŨ/CHỈ SỐ DƯỚI (w:vertAlign): raw text bẹp "10⁶"→"106", "25⁰C"→"250C".
 *     Giữ lại dạng ^{...}/_{...} để AI đọc đúng công thức text.
 *
 * KHÔNG xử lý được: ảnh WMF/EMF và công thức MathType mà bộ giải mã MTEF không
 * đọc nổi (hiếm) — gặp thì chèn ghi chú "[CÔNG THỨC — nhập tay]" để giáo viên
 * biết chỗ cần bổ sung, không âm thầm mất công thức.
 *
 * Bung zip bằng adm-zip (pure JS) + regex trên document.xml. Hỏng/thiếu gì thì
 * trả text gần đúng nhất chứ KHÔNG ném lỗi (import vẫn chạy).
 */

import AdmZip from "adm-zip";
import { injectOmmlText, FORMULA_NOTE } from "./omml-text.ts";
import { mtefToLatex } from "./mtef-latex.ts";

const ANSWER_MARK = "[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]";

/** Các mã màu thường được dùng để đánh dấu đáp án đúng:
 *  - Đỏ / Đỏ thẫm / Đỏ gạch / Đỏ cam (phổ biến nhất)
 *  - Xanh dương / Xanh lam (nhiều GV dùng để phân biệt với bút đỏ chấm bài)
 *  - Xanh lá cây (nhiều phần mềm trắc nghiệm xuất ra)
 *  - Tím / Hồng đậm / Cam
 */
const ANSWER_COLOR_RE = /^(?:FF0000|C00000|E53935|D32F2F|B71C1C|FF5252|FF1744|F44336|ED1C24|800000|990000|DC3545|CC0000|0000FF|0070C0|1E88E5|0D6EFD|002060|418AB3|2F5597|1F497D|008000|00B050|28A745|198754|388E3C|2E7D32|375623|548235|7030A0|6F42C1|800080|FF6600|ED7D31)$/i;

function isAnswerColor(color: string | null): boolean {
  if (!color) return false;
  const c = color.trim().toUpperCase();
  if (ANSWER_COLOR_RE.test(c)) return true;
  // Bỏ qua màu đen/xám/auto mặc định
  if (/^(AUTO|000000|0A0A0A|1A1A1A|222222|262626|333333|444444|555555|595959|7F7F7F|808080)$/i.test(c)) return false;
  // Các màu có sắc tố rõ rệt (có R/G/B lệch hẳn nhau)
  if (/^[0-9A-F]{6}$/i.test(c)) {
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min >= 50 && (max > 100 || min < 150)) return true;
  }
  return false;
}

interface Run {
  text: string;
  color: string | null;
  /** Nền highlight (yellow/green/…) — giáo viên dùng highlight tô đáp
   *  án đúng thay vì đổi màu chữ. `null` = không highlight. */
  highlight: string | null;
  /** Gạch chân — đề Đúng/Sai hoặc MCQ dùng gạch chân đáp án ĐÚNG. */
  underline: boolean;
  /** In đậm — nhiều GV in đậm chữ cái hoặc toàn bộ phương án đúng. */
  bold: boolean;
}

/** Tách các run trong 1 đoạn, kèm màu chữ, highlight, gạch chân, in đậm. */
function parseRuns(paraXml: string): Run[] {
  const runs: Run[] = [];
  const runRe = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
  let m: RegExpExecArray | null;
  while ((m = runRe.exec(paraXml)) !== null) {
    const inner = m[1];
    const rprEnd = inner.indexOf("</w:rPr>");
    const head = rprEnd >= 0 ? inner.slice(0, rprEnd) : "";
    const colorMatch = /<w:color\s+w:val="([^"]+)"/.exec(head);
    const color = colorMatch ? colorMatch[1].toUpperCase() : null;
    // w:highlight w:val="yellow|green|cyan|…"; val="none" = bỏ highlight.
    const hlMatch = /<w:highlight\s+w:val="([^"]+)"/.exec(head);
    const hl = hlMatch ? hlMatch[1].toLowerCase() : null;
    const highlight = hl && hl !== "none" ? hl : null;
    // w:u w:val="single|double|thick|…"; val="none" = tắt gạch chân.
    const uMatch = /<w:u(?:\s+w:val="([^"]+)")?\s*\/>/.exec(head);
    const underline = !!uMatch && (!uMatch[1] || uMatch[1].toLowerCase() !== "none");
    // w:b hoặc w:bCs (bold cho complex scripts)
    const bMatch = /<w:b(?:\s+w:val="([^"]+)")?\s*\/>|<w:bCs(?:\s+w:val="([^"]+)")?\s*\/>/.exec(head);
    const bVal = bMatch ? (bMatch[1] ?? bMatch[2]) : null;
    const bold = !!bMatch && (!bVal || !/^(0|false|off|none)$/i.test(bVal));
    const vAlignMatch = /<w:vertAlign\s+w:val="([^"]+)"/.exec(head);
    const vAlign = vAlignMatch ? vAlignMatch[1] : null;
    let text = "";
    // w:t thường; BỎ w:instrText (mã field như PAGE — rác); tab/break giữ chỗ.
    // Mỗi nhánh alternation riêng để tag tự đóng không nuốt chữ phía sau.
    const parts: string[] = [];
    const tokenRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab[^>]*\/>|<w:br[^>]*\/>|<w:noBreakHyphen[^>]*\/>/g;
    let t: RegExpExecArray | null;
    while ((t = tokenRe.exec(inner)) !== null) {
      const full = t[0];
      if (full.startsWith("<w:t")) parts.push(t[1]);
      else if (full.startsWith("<w:tab")) parts.push(" ");
      else if (full.startsWith("<w:br")) parts.push("\n");
      else parts.push("-");
    }
    text = parts.join("");
    if (vAlign === "superscript" && text.trim()) text = `^{${text}}`;
    else if (vAlign === "subscript" && text.trim()) text = `_{${text}}`;
    if (text) runs.push({ text, color, highlight, underline, bold });
  }
  return runs;
}

interface OptionSeg {
  letter: string;
  text: string;
  marked: boolean;
  hasColor: boolean;
  hasHighlight: boolean;
  hasUnderline: boolean;
  hasBold: boolean;
}

/** Chia nhỏ các run nếu trong 1 run có chứa nhiều lựa chọn dính liền
 *  (vd run chứa "A. Hà Nội    B. Đà Nẵng") để mỗi lựa chọn có run riêng
 *  giữ nguyên định dạng (màu, đậm, gạch chân). */
function subdivideRuns(runs: Run[]): Run[] {
  const result: Run[] = [];
  const optSplitRe = /(?<=[\s\t.,;:()"'$]|^)([A-F])[\.\)\:](?=[\sA-Za-zÀ-ỹ0-9$\\\(\[{]|$)/g;
  for (const r of runs) {
    const text = r.text;
    const marks: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = optSplitRe.exec(text)) !== null) {
      if (m.index > 0) marks.push(m.index);
    }
    if (!marks.length) {
      result.push(r);
      continue;
    }
    let last = 0;
    for (const pos of marks) {
      if (pos > last) {
        result.push({ ...r, text: text.slice(last, pos) });
        last = pos;
      }
    }
    if (last < text.length) {
      result.push({ ...r, text: text.slice(last) });
    }
  }
  return result;
}

/** Cắt 1 đoạn văn thành các lựa chọn A/B/C/D/E/F (nhiều đáp án hay nằm chung
 *  1 đoạn, cách nhau bằng tab). Giữ màu từng run để phát hiện đáp án tô màu,
 *  highlight, gạch chân hoặc in đậm ở chữ cái HOẶC ở nội dung. */
function splitOptions(rawRuns: Run[]): OptionSeg[] {
  const runs = subdivideRuns(rawRuns);
  const segs: OptionSeg[] = [];
  let cur: Run[] = [];
  const flush = () => {
    if (!cur.length) return;
    const text = cur.map((r) => r.text).join("").replace(/[ \t]+/g, " ").trim();
    const lm = /^([A-F])[\.\)\:]/.exec(text);
    if (lm) {
      const hasColor = cur.some((r) => isAnswerColor(r.color));
      const hasHighlight = cur.some((r) => r.highlight !== null);
      const hasUnderline = cur.some((r) => r.underline && r.text.trim().length > 0);
      const hasBold = cur.some((r) => r.bold && r.text.trim().length > 0);
      segs.push({
        letter: lm[1],
        text,
        marked: hasColor || hasHighlight,
        hasColor,
        hasHighlight,
        hasUnderline,
        hasBold,
      });
    }
    cur = [];
  };
  for (const r of runs) {
    if (/^[A-F][\.\)\:]/.test(r.text.trim()) && cur.length > 0) flush();
    cur.push(r);
  }
  flush();

  // Phát hiện gạch chân hoặc in đậm đặc trưng: nếu trong nhóm lựa chọn (>=2),
  // chỉ duy nhất 1 phương án có gạch chân hoặc in đậm (trong khi các phương án khác không có)
  if (segs.length >= 2) {
    const underlined = segs.filter((s) => s.hasUnderline);
    if (underlined.length === 1 && !segs.some((s) => s.marked)) {
      underlined[0].marked = true;
    }
    const bolded = segs.filter((s) => s.hasBold);
    if (bolded.length === 1 && !segs.some((s) => s.marked)) {
      bolded[0].marked = true;
    }
  }

  return segs;
}

export interface DocxExtract {
  /** Text giữ số mũ + marker đáp án. */
  text: string;
  /** Số dòng đáp án đã đánh dấu (0 = tài liệu không tô màu → như cũ). */
  marked: number;
  /** Số đoạn text trích được (debug). */
  paragraphs: number;
  /** Key trích độc lập từ màu đỏ: chữ cái + nội dung đáp án (để đối chiếu). */
  key: DocxKey[];
  /** Số ảnh nhúng trong docx (word/media/*) — không trích nội dung, chỉ đếm
   *  để báo giáo viên "file có hình". */
  images: number;
  /** PARSE-3: số công thức Word (OMML) đã render thành chữ dễ đọc. */
  equations: number;
  /** PARSE-6: số công thức MathType (OLE) đã giải mã thành LaTeX. */
  mtefEquations: number;
  /** PARSE-6: số công thức OLE còn lại KHÔNG giải mã được (đã ghi chú). */
  legacyEquations: number;
}

/** 1 đáp án tô đỏ trong tài liệu. */
export interface DocxKey {
  letter: string;
  text: string;
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[\s\p{P}]/gu, "");
}

/**
 * Đối chiếu đáp án model với key màu đỏ (không tin model tuyệt đối).
 * Chỉ override khi khớp DUY NHẤT 1 chữ cái qua nội dung đủ dài (≥8 ký tự sau
 * chuẩn hoá — tránh "Đúng"/"Sai" ngắn ngủi trùng lung tung). Không khớp hoặc
 * khớp nhiều chữ → giữ nguyên + bật needsReview để giáo viên quyết.
 */
export function reconcileDocKey<
  T extends {
    type: string;
    answer?: string;
    options?: string[];
    answerSource?: string;
    confidence?: number;
    needsReview?: boolean;
  },
>(questions: T[], key: DocxKey[]): { questions: T[]; overridden: number } {
  let overridden = 0;
  // Bỏ tiền tố "A." để so khớp nội dung thuần ("A. 775 kJ." → "775kj").
  // Giữ cả bản full (chứa chữ cái) cho luật bao hàm cũ.
  const usable = key
    .map((k) => ({
      letter: k.letter.toUpperCase(),
      full: normKey(k.text),
      bare: normKey(k.text.replace(/^[A-F][\.\)\:]\s*/i, "")),
    }))
    .filter((k) => /^[A-F]$/.test(k.letter) && (k.full.length >= 4 || k.bare.length >= 1));
  if (!usable.length) return { questions, overridden };

  // Tần suất text đáp án trên TOÀN đề: text trùng ở nhiều câu (số "2", "Đúng")
  // thì khớp tuyệt đối không còn đáng tin → chỉ chứa mới tính.
  const freq = new Map<string, number>();
  for (const q of questions) {
    if (q.type !== "mcq" || !Array.isArray(q.options)) continue;
    const seen = new Set<string>();
    for (const opt of q.options) {
      const n = normKey(String(opt ?? ""));
      if (n.length >= 1 && !seen.has(n)) {
        seen.add(n);
        freq.set(n, (freq.get(n) ?? 0) + 1);
      }
    }
  }

  for (const q of questions) {
    if (q.type !== "mcq" || !Array.isArray(q.options)) continue;
    const letters = new Set<string>();
    for (const k of usable) {
      const optIdx = k.letter.charCodeAt(0) - 65;
      const directOpt = optIdx >= 0 && optIdx < q.options.length ? normKey(String(q.options[optIdx] ?? "")) : "";
      if (directOpt && directOpt === k.bare) {
        letters.add(k.letter);
        continue;
      }
      for (const opt of q.options) {
        const no = normKey(String(opt ?? ""));
        const exact = no.length >= 2 && no === k.bare && freq.get(no) === 1;
        const contains =
          no.length >= 6 && k.full.length >= 6 && (no.includes(k.full) || k.full.includes(no));
        if (exact || contains) {
          letters.add(k.letter);
          break;
        }
      }
    }
    if (letters.size === 1) {
      const letter = [...letters][0];
      if (q.answer !== letter || q.answerSource !== "document") {
        q.answer = letter;
        q.answerSource = "document";
        q.confidence = 1;
        q.needsReview = false;
        overridden++;
      }
    } else if (letters.size > 1) {
      // Đáp án đã lấy trực tiếp từ highlight của chính lựa chọn trong câu
      // (marker inline) thì key cuối bài khớp mơ hồ không được ghi đè/đánh dấu.
      if (q.answerSource !== "document" || !q.answer) q.needsReview = true;
    }
  }
  return { questions, overridden };
}

/**
 * Serialize 1 bảng DOCX thành các dòng "| ô | ô |" — giữ cấu trúc lưới
 * (thay vì để mỗi ô thành dòng rời như trước). Ô có run đỏ (đáp án tô
 * màu) được gắn marker. Bảng lồng nhau rất hiếm — làm phẳng, không giữ
 * cấp.
 */
function serializeTable(tblXml: string): string[] {
  const rowRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  const rows: string[] = [];
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(tblXml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      // Mỗi <w:p> trong ô là 1 dòng logic — nối các paragraph bằng xuống dòng
      // để lựa chọn "A. …" / "B. …" nằm riêng dòng (trước đây dính liền
      // "A. JunB. Oát" vì gộp phẳng mọi run của ô).
      const paras: string[] = [];
      const paraRed: boolean[] = [];
      const pRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
      let pm: RegExpExecArray | null;
      while ((pm = pRe.exec(cm[1])) !== null) {
        const runs = parseRuns(pm[1]);
        paras.push(runs.map((r) => r.text).join("").replace(/[ \t]+/g, " ").trim());
        paraRed.push(
          runs.some((r) => isAnswerColor(r.color) || r.highlight !== null || (r.underline && r.text.trim().length > 0)),
        );
      }
      const text = paras.filter(Boolean).join(" ; ").trim() || " ";
      const red = paraRed.some(Boolean);
      cells.push(red ? `${text} ${ANSWER_MARK}` : text);
    }
    if (cells.length) rows.push(`| ${cells.join(" | ")} |`);
  }
  return rows;
}

/** Một định nghĩa numbering cấp 0: lvlText ("Câu %1.") + start. */
export interface NumberingDef {
  lvlText: string;
  start: number;
}

/**
 * Đọc word/numbering.xml → map numId → định nghĩa cấp 0 (lvlText, start).
 * numId trỏ tới abstractNumId; lấy <w:lvl w:ilvl="0"> của abstract đó.
 */
export function parseNumbering(numberingXml: string): Map<string, NumberingDef> {
  const out = new Map<string, NumberingDef>();
  if (!numberingXml || !numberingXml.includes("<w:numbering")) return out;

  const abstractLvl0 = new Map<string, NumberingDef>();
  const absRe = /<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/g;
  let am: RegExpExecArray | null;
  while ((am = absRe.exec(numberingXml)) !== null) {
    const lvl0Re = /<w:lvl\b[^>]*w:ilvl="0"[^>]*>([\s\S]*?)<\/w:lvl>/;
    const lvl0 = lvl0Re.exec(am[0])?.[1] ?? "";
    const lvlText = /<w:lvlText\b[^>]*w:val="([^"]*)"/.exec(lvl0)?.[1] ?? "";
    const start = Number(/<w:start\b[^>]*w:val="(\d+)"/.exec(lvl0)?.[1] ?? "1");
    abstractLvl0.set(am[1], { lvlText, start: Number.isFinite(start) && start > 0 ? start : 1 });
  }

  const numRe = /<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g;
  let nm: RegExpExecArray | null;
  while ((nm = numRe.exec(numberingXml)) !== null) {
    const abstractId = /<w:abstractNumId\b[^>]*w:val="(\d+)"/.exec(nm[2])?.[1];
    if (abstractId && abstractLvl0.has(abstractId)) out.set(nm[1], abstractLvl0.get(abstractId)!);
  }
  return out;
}

/** Escape text để nhét vào <w:t> (giữ nguyên $…$ cho tầng hiển thị). */
function escapeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * PARSE-6: thay các object MathType (OLE `Equation.DSMT4`) bằng LaTeX `$…$`.
 * Mỗi object nằm ở `<w:object>…<o:OLEObject r:id="rIdN"/>…</w:object>`; file
 * nhị phân tương ứng là `word/embeddings/oleObjectN.bin` (tra qua
 * `word/_rels/document.xml.rels`). Decode thất bại → giữ ghi chú nhập tay để
 * KHÔNG âm thầm mất công thức.
 */
function injectOleMathText(
  xml: string,
  zip: AdmZip,
): { xml: string; decoded: number; failed: number } {
  const relXml = zip.getEntry("word/_rels/document.xml.rels")?.getData().toString("utf8") ?? "";
  const relMap = new Map<string, string>();
  const relRe = /<Relationship\b[^>]*>/g;
  let rm: RegExpExecArray | null;
  while ((rm = relRe.exec(relXml)) !== null) {
    const id = /\bId="([^"]+)"/.exec(rm[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(rm[0])?.[1];
    if (id && target) relMap.set(id, target);
  }

  let decoded = 0;
  let failed = 0;
  const out = xml.replace(/<w:object\b[\s\S]*?<\/w:object>/g, (block) => {
    const ole = /<o:OLEObject\b[^>]*>/.exec(block)?.[0];
    if (!ole) return block;
    const progId = /ProgID="([^"]+)"/.exec(ole)?.[1] ?? "";
    if (!/^(Equation\.|MathType)/i.test(progId)) return block;

    const rid = /\br:id="([^"]+)"/.exec(ole)?.[1];
    const target = rid ? relMap.get(rid) : undefined;
    const path = target
      ? `word/${target.replace(/^\.?\//, "").replace(/^word\//, "")}`
      : "";
    const entry = path ? zip.getEntry(path) : null;
    const tex = entry ? mtefToLatex(entry.getData()) : "";
    if (!tex) {
      failed++;
      return `<w:t xml:space="preserve">${FORMULA_NOTE}</w:t>`;
    }
    decoded++;
    return `<w:t xml:space="preserve">${escapeXmlText(`$${tex}$`)}</w:t>`;
  });
  return { xml: out, decoded, failed };
}

export function extractDocxText(docxBuffer: Buffer): DocxExtract {
  const empty: DocxExtract = {
    text: "",
    marked: 0,
    paragraphs: 0,
    key: [],
    images: 0,
    equations: 0,
    mtefEquations: 0,
    legacyEquations: 0,
  };
  try {
    // docx là file zip — bung lấy word/document.xml trước (buffer thô toàn rác zip).
    const zip = new AdmZip(docxBuffer);
    const entry = zip.getEntry("word/document.xml");
    if (!entry) return empty;
    const rawXml = entry.getData().toString("utf8");
    if (!rawXml.includes("<w:document")) return empty;
    // Ảnh THẬT của đề: chỉ đếm ảnh được tham chiếu ngoài <w:object>. Bên trong
    // <w:object> là ảnh preview WMF/EMF của công thức MathType — không phải hình
    // minh hoạ, đếm vào sẽ báo sai "tài liệu có 122 ảnh".
    const withoutObjects = rawXml.replace(/<w:object\b[\s\S]*?<\/w:object>/g, "");
    const imageRefs = new Set<string>();
    const imgRe = /<a:blip\b[^>]*r:embed="([^"]+)"|<v:imagedata\b[^>]*r:id="([^"]+)"/g;
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(withoutObjects)) !== null) imageRefs.add(im[1] ?? im[2]);
    const images = imageRefs.size;

    // PARSE-3: công thức Word (OMML) → LaTeX. PARSE-6: object MathType (OLE
    // Equation.DSMT4) → LaTeX; chỉ còn lại những object decode lỗi mới tính là
    // "công thức cũ chưa đọc được".
    const injected = injectOmmlText(rawXml);
    const ole = injectOleMathText(injected.xml, zip);
    // Chữ trong hộp vẽ WordArt/watermark (vd "NDL" trắng cỡ 1pt) không phải nội
    // dung đề — bỏ để không dính vào câu hỏi.
    const xml = ole.xml
      .replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, "")
      .replace(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g, "");
    const mtefEquations = ole.decoded;

    // PARSE-5: đề 2025 đánh số câu bằng numbering tự động của Word — chữ "Câu N."
    // KHÔNG nằm trong <w:t> mà ở word/numbering.xml (lvlText "Câu %1.") + <w:numPr>.
    // Đọc bảng numbering để sinh lại tiền tố khi bóc chữ.
    const numbering = parseNumbering(zip.getEntry("word/numbering.xml")?.getData().toString("utf8") ?? "");
    const numCounters = new Map<string, number>();

    const lines: { text: string; marked: boolean; segs: OptionSeg[] }[] = [];
    const allSegs: OptionSeg[] = [];
    let paraCount = 0;
    // Duyệt theo thứ tự tài liệu: gặp <w:tbl> thì serialize thành lưới
    // (các <w:p> bên trong bảng đã bị consumes — không lẫn vào pass đoạn văn).
    const blockRe = /<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>|<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
    let pm: RegExpExecArray | null;
    while ((pm = blockRe.exec(xml)) !== null) {
      if (pm[1] !== undefined) {
        const rows = serializeTable(pm[1]);
        if (rows.length) {
          paraCount++;
          lines.push({ text: rows.join("\n"), marked: false, segs: [] });
        }
        continue;
      }
      const runs = parseRuns(pm[2]);
      let text = runs.map((r) => r.text).join("").replace(/[ \t]+/g, " ").trim();
      // PARSE-5: paragraph có numbering tự động → sinh tiền tố "Câu N." (theo
      // lvlText của numId). Bộ đếm RIÊNG cho từng numId (mỗi list tự đếm từ start).
      const numId = /<w:numId w:val="(\d+)"/.exec(pm[2])?.[1];
      if (numId && numbering.has(numId)) {
        const def = numbering.get(numId)!;
        const count = (numCounters.get(numId) ?? def.start - 1) + 1;
        numCounters.set(numId, count);
        const prefix = def.lvlText.replace(/%\d+/g, String(count)).trim();
        if (prefix) text = `${prefix} ${text}`.trim();
      }
      if (!text) continue;
      paraCount++;
      // Đề Đúng/Sai: giáo viên gạch chân, in đậm hoặc tô màu các mệnh đề ĐÚNG (không highlight) —
      // gắn marker vào dòng mệnh đề để parser suy ra đáp án Đ/S.
      const markedTf = runs.some(
        (r) =>
          ((r.underline || r.bold) && r.text.trim().length > 0) ||
          isAnswerColor(r.color) ||
          r.highlight !== null,
      );
      const segs = splitOptions(runs);
      if (segs.length > 0) {
        allSegs.push(...segs);
        lines.push({ text: segs.map((s) => s.text).join("  "), marked: segs.some((s) => s.marked), segs });
      } else if (markedTf && /^[a-d]\s*[.)]/.test(text)) {
        lines.push({ text: `${text} ${ANSWER_MARK}`, marked: true, segs: [] });
      } else {
        lines.push({ text, marked: false, segs: [] });
      }
    }

    // Chỉ đánh dấu khi đáp án tô màu/đánh dấu là thiểu số rõ rệt (tránh tài liệu tô màu toàn bộ):
    const markedSegs = allSegs.filter((s) => s.marked).length;
    const useMarks =
      allSegs.length >= 2 &&
      markedSegs > 0 &&
      (allSegs.length <= 4 ? markedSegs === 1 : markedSegs <= Math.ceil(allSegs.length * 0.5));

    let marked = 0;
    // Key độc lập cho đối chiếu: chữ cái + nội dung đáp án đỏ.
    const key: DocxKey[] = useMarks
      ? allSegs.filter((s) => s.marked).map((s) => ({ letter: s.letter, text: s.text }))
      : [];
    const out = lines.map((line) => {
      if (!useMarks || !line.marked) return line.text;
      // Marker gắn NGAY SAU đáp án đỏ (không để cuối dòng — dòng có thể chứa
      // nhiều đáp án, model không biết marker của ai).
      const parts = line.segs.length
        ? line.segs.map((s) => (s.marked ? `${s.text} ${ANSWER_MARK}` : s.text)).join("  ")
        : line.text;
      marked += line.segs.filter((s) => s.marked).length || 1;
      return parts;
    });

    return {
      text: out.join("\n\n").trim(),
      marked,
      paragraphs: paraCount,
      key,
      images,
      equations: injected.equations,
      mtefEquations,
      legacyEquations: ole.failed,
    };
  } catch {
    return empty;
  }
}

/** Hậu tố marker để toReviewItem dọn trước khi lưu/hiển thị cho học sinh. */
export const ANSWER_MARK_SUFFIX = ANSWER_MARK;
