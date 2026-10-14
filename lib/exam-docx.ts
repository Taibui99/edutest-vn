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
 * KHÔNG xử lý được: phương trình OLE cũ (Equation Editor 3.0, .bin + preview
 * WMF — nhị phân đóng, không parse được server-side) và ảnh WMF/EMF. Gặp thì
 * câu đó thiếu công thức, AI phải đánh needsReview — nói rõ với user.
 *
 * Bung zip bằng adm-zip (pure JS) + regex trên document.xml. Hỏng/thiếu gì thì
 * trả text gần đúng nhất chứ KHÔNG ném lỗi (import vẫn chạy).
 */

import AdmZip from "adm-zip";

const ANSWER_MARK = "[ĐÁP ÁN ĐÚNG THEO TÀI LIỆU]";

/** Đáp án đúng thường được tô ĐỎ (giáo viên Việt Nam). Danh sách đóng để
 *  tránh tô bừa khi giáo viên tô màu trang trí. */
const ANSWER_RED = /^(FF0000|C00000|E53935|D32F2F|B71C1C|FF5252|FF1744|F44336)$/i;

interface Run {
  text: string;
  color: string | null;
}

/** Tách các run trong 1 đoạn, kèm màu chữ (null = mặc định/đen). */
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
    if (text) runs.push({ text, color });
  }
  return runs;
}

interface OptionSeg {
  letter: string;
  text: string;
  hasRed: boolean;
}

/** Cắt 1 đoạn văn thành các lựa chọn A/B/C/D (nhiều đáp án hay nằm chung
 *  1 đoạn, cách nhau bằng tab). Giữ màu từng run để phát hiện đáp án tô đỏ
 *  ở chữ cái HOẶC ở nội dung (file thật có cả 2 kiểu). */
function splitOptions(runs: Run[]): OptionSeg[] {
  const segs: OptionSeg[] = [];
  let cur: Run[] = [];
  const flush = () => {
    if (!cur.length) return;
    const text = cur.map((r) => r.text).join("").replace(/[ \t]+/g, " ").trim();
    const lm = /^([A-D])[\.\)\:]/.exec(text);
    if (lm) {
      segs.push({
        letter: lm[1],
        text,
        hasRed: cur.some((r) => r.color !== null && ANSWER_RED.test(r.color as string)),
      });
    }
    cur = [];
  };
  for (const r of runs) {
    // Run mới bắt đầu bằng "B." / "C)"... → đáp án mới (kể cả run chỉ có chữ cái).
    if (/^[A-D][\.\)\:]/.test(r.text.trim()) && cur.length > 0) flush();
    cur.push(r);
  }
  flush();
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
  const usable = key
    .map((k) => ({ letter: k.letter.toUpperCase(), norm: normKey(k.text) }))
    .filter((k) => /^[A-D]$/.test(k.letter) && k.norm.length >= 8);
  if (!usable.length) return { questions, overridden };

  for (const q of questions) {
    if (q.type !== "mcq" || !Array.isArray(q.options)) continue;
    const letters = new Set<string>();
    for (const k of usable) {
      for (const opt of q.options) {
        const no = normKey(String(opt ?? ""));
        if (no.length >= 8 && (no.includes(k.norm) || k.norm.includes(no))) {
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
      q.needsReview = true;
    }
  }
  return { questions, overridden };
}

export function extractDocxText(docxBuffer: Buffer): DocxExtract {
  const empty: DocxExtract = { text: "", marked: 0, paragraphs: 0, key: [] };
  try {
    // docx là file zip — bung lấy word/document.xml trước (buffer thô toàn rác zip).
    const entry = new AdmZip(docxBuffer).getEntry("word/document.xml");
    if (!entry) return empty;
    const xml = entry.getData().toString("utf8");
    if (!xml.includes("<w:document")) return empty;

    const lines: { text: string; red: boolean; segs: OptionSeg[] }[] = [];
    const allSegs: OptionSeg[] = [];
    let paraCount = 0;
    const paraRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
    let pm: RegExpExecArray | null;
    while ((pm = paraRe.exec(xml)) !== null) {
      const runs = parseRuns(pm[1]);
      const text = runs.map((r) => r.text).join("").replace(/[ \t]+/g, " ").trim();
      if (!text) continue;
      paraCount++;
      const segs = splitOptions(runs);
      if (segs.length > 0) {
        allSegs.push(...segs);
        lines.push({ text: segs.map((s) => s.text).join("  "), red: segs.some((s) => s.hasRed), segs });
      } else {
        lines.push({ text, red: false, segs: [] });
      }
    }

    // Chỉ đánh dấu khi đáp án đỏ là thiểu số rõ rệt (tránh tài liệu tô đỏ
    // toàn bộ): cần ít nhất 4 lựa chọn và số dòng đỏ < 50%.
    const redSegs = allSegs.filter((s) => s.hasRed).length;
    const useMarks = allSegs.length >= 4 && redSegs > 0 && redSegs < allSegs.length / 2;

    let marked = 0;
    // Key độc lập cho đối chiếu: chữ cái + nội dung đáp án đỏ.
    const key: DocxKey[] = useMarks
      ? allSegs.filter((s) => s.hasRed).map((s) => ({ letter: s.letter, text: s.text }))
      : [];
    const out = lines.map((line) => {
      if (!useMarks || !line.red) return line.text;
      // Marker gắn NGAY SAU đáp án đỏ (không để cuối dòng — dòng có thể chứa
      // nhiều đáp án, model không biết marker của ai).
      const parts = line.segs.length
        ? line.segs.map((s) => (s.hasRed ? `${s.text} ${ANSWER_MARK}` : s.text)).join("  ")
        : line.text;
      marked += line.segs.filter((s) => s.hasRed).length || 1;
      return parts;
    });

    return { text: out.join("\n\n").trim(), marked, paragraphs: paraCount, key };
  } catch {
    return empty;
  }
}

/** Hậu tố marker để toReviewItem dọn trước khi lưu/hiển thị cho học sinh. */
export const ANSWER_MARK_SUFFIX = ANSWER_MARK;
