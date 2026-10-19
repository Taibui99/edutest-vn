/**
 * Bóc chữ PDF GIỮ BỐ CỤC bằng pdfjs-dist (thuần rule, không AI).
 *
 * pdf-parse (lựa chọn cũ) đọc theo thứ tự stream nội bộ → đề 2 cột bị
 * đan xen từng dòng (dòng trái xen dòng phải). Ở đây:
 *   1. Lấy text items + toạ độ từ pdf.js.
 *   2. Gom items thành dòng theo trục Y.
 *   3. Phát hiện 2 cột theo X (đề thi Word xuất PDF hay 2 cột); cột trái
 *      đọc hết rồi mới cột phải; dòng "trải ngang" (tiêu đề) đọc trước.
 *   4. pdfjs rỗng/lỗi → fallback pdf-parse như cũ.
 *
 * Import tương đối + dynamic import để `node scripts/qa-pdf-layout.mjs`
 * chạy được và Next không bundle pdf.js vào client.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

export interface PdfLayoutText {
  text: string;
  pages: number;
  engine: "pdfjs-layout" | "pdf-parse";
}

/** Items nằm trong khoảng Y này (pt) coi là cùng dòng. */
const LINE_Y_TOLERANCE = 2.5;
/** Mỗi cột phải có tối thiểu bao nhiêu ký tự mới coi là "2 cột". */
const MIN_COLUMN_CHARS = 40;
/** Dòng rộng hơn tỷ lệ này so với trang là dòng trải ngang (tiêu đề). */
const SPAN_RATIO = 0.35;

interface PdfItem {
  x: number;
  y: number;
  w: number;
  str: string;
}

function needSpace(prev: string, next: string): boolean {
  if (!prev || !next) return false;
  const p = prev[prev.length - 1];
  const n = next[0];
  if (/\s/.test(p) || /\s/.test(n)) return false;
  if (/[-–—/({[]/.test(p)) return false;
  if (/[.,;:!?)}\]]/.test(n)) return false;
  return true;
}

/** Items (đã sort) → các dòng, mỗi dòng là chuỗi. */
function itemsToLines(items: PdfItem[]): string[] {
  const sorted = [...items].sort((a, b) => {
    const dy = b.y - a.y; // PDF y lớn = trên trang
    if (Math.abs(dy) > LINE_Y_TOLERANCE) return dy;
    return a.x - b.x;
  });
  const lines: string[] = [];
  let curY = Number.NaN;
  let cur: PdfItem[] = [];
  const flush = () => {
    if (!cur.length) return;
    cur.sort((a, b) => a.x - b.x);
    let s = "";
    for (const it of cur) {
      const str = it.str;
      if (!str) continue;
      if (needSpace(s, str)) s += " ";
      s += str;
    }
    if (s.trim()) lines.push(s.trim());
    cur = [];
  };
  for (const it of sorted) {
    if (!it.str) continue;
    if (Number.isNaN(curY) || Math.abs(it.y - curY) > LINE_Y_TOLERANCE) {
      flush();
      curY = it.y;
    }
    cur.push(it);
  }
  flush();
  return lines;
}

/**
 * Dựng lại thứ tự đọc 1 trang: 2 cột → cột trái trước; dòng trải ngang
 * (tiêu đề) đứng đầu. Trả về text đã nối dòng.
 */
function layoutPage(items: PdfItem[], pageWidth: number): string {
  if (!items.length) return "";
  const spanW = pageWidth * SPAN_RATIO;
  const spanning = items.filter((it) => it.w > spanW);
  const normal = items.filter((it) => it.w <= spanW);
  const left = normal.filter((it) => it.x + it.w / 2 < pageWidth / 2);
  const right = normal.filter((it) => it.x + it.w / 2 >= pageWidth / 2);
  const chars = (arr: PdfItem[]) => arr.reduce((n, it) => n + it.str.length, 0);
  const twoCol = left.length >= 3 && right.length >= 3
    && chars(left) >= MIN_COLUMN_CHARS && chars(right) >= MIN_COLUMN_CHARS;

  const parts: string[] = [];
  if (spanning.length) parts.push(...itemsToLines(spanning));
  if (twoCol) {
    parts.push(...itemsToLines(left));
    parts.push(...itemsToLines(right));
  } else {
    parts.push(...itemsToLines(normal.length ? normal : items));
  }
  return parts.join("\n");
}

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

interface PdfjsHandle {
  pdfjs: PdfjsModule;
  standardFontDataUrl?: string;
  cMapUrl?: string;
}

/** Worker + font data tốt nhất có thể (Node); lỗi thì để pdf.js tự xử lý. */
async function loadPdfjs(): Promise<PdfjsHandle> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const req = createRequire(import.meta.url);
    const dir = path.dirname(req.resolve("pdfjs-dist/package.json"));
    const worker = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    const g = pdfjs as unknown as { GlobalWorkerOptions?: { workerSrc?: string } };
    if (g.GlobalWorkerOptions && !g.GlobalWorkerOptions.workerSrc) {
      g.GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href;
    }
    return {
      pdfjs,
      // pdf.js v6: đường dẫn phải kiểu URL "/"; path Windows "\" bị từ chối,
      // file:// thì load không được → đổi \ thành / giữ nguyên ổ đĩa.
      standardFontDataUrl: dir.replace(/\\/g, "/") + "/standard_fonts/",
      cMapUrl: dir.replace(/\\/g, "/") + "/cmaps/",
    };
  } catch {
    return { pdfjs, standardFontDataUrl: undefined, cMapUrl: undefined };
  }
}

async function extractWithPdfjs(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { pdfjs, standardFontDataUrl, cMapUrl } = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
  });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const it of content.items) {
      if (!("str" in it) || typeof it.str !== "string" || !it.str) continue;
      const tr = it.transform as number[];
      items.push({ x: tr[4], y: tr[5], w: Number(it.width) || 0, str: it.str });
    }
    pages.push(layoutPage(items, viewport.width));
    page.cleanup?.();
  }
  const n = doc.numPages;
  await task.destroy(); // pdf.js v6: destroy trên task, không phải doc
  return { text: pages.join("\n"), pages: n };
}

/**
 * Bóc chữ PDF. Ưu tiên pdfjs-layout (giữ 2 cột); pdfjs rỗng/lỗi → pdf-parse.
 */
export async function extractPdfLayoutText(buffer: Buffer): Promise<PdfLayoutText> {
  let pages = 0;
  try {
    const { text, pages: n } = await extractWithPdfjs(buffer);
    pages = n;
    if (text.replace(/\s/g, "").length >= 10) {
      return { text, pages, engine: "pdfjs-layout" };
    }
    console.warn(`[pdf-layout] pdfjs extracted too little (${text.length} chars); fallback=pdf-parse`);
  } catch (e) {
    console.warn("[pdf-layout] pdfjs failed; fallback=pdf-parse", e);
  }
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return { text: data?.text ?? "", pages: data?.numpages ?? pages, engine: "pdf-parse" };
}
