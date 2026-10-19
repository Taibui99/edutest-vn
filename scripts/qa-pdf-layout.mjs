/**
 * Test bố cục đọc PDF (pdf-layout) — dựng PDF ASCII bằng tay, không AI.
 * Chạy: node scripts/qa-pdf-layout.mjs
 */
import assert from "node:assert/strict";
import { extractPdfLayoutText } from "../lib/pdf-layout.ts";

let passed = 0;
const t = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log("  ok  " + name);
  } catch (e) {
    console.log("  FAIL " + name + " :: " + e.message);
    process.exitCode = 1;
  }
};

/** Dựng PDF 1 trang ASCII từ danh sách {text,x,y,w}. */
function buildPdf(items, pageW = 595) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = items
    .map((it) => `BT /F1 11 Tf ${it.x} ${it.y} Td (${esc(it.text)}) Tj ET`)
    .join("\n") + "\n";
  const objs = [];
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`;
  objs[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`;
  objs[4] = `<< /Length ${content.length} >>\nstream\n${content}endstream`;
  objs[5] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

await t("PDF 2 cột: cột trái đọc hết trước cột phải", async () => {
  const left = ["Cau 1: 1 + 1 = ?", "A. 1", "B. 2", "C. 3", "D. 4", "Dap an: B"];
  const right = ["Cau 2: 2 + 2 = ?", "A. 2", "B. 3", "C. 4", "D. 5", "Dap an: C"];
  const items = [
    ...left.map((text, i) => ({ text, x: 50, y: 800 - i * 14, w: 80 })),
    ...right.map((text, i) => ({ text, x: 320, y: 800 - i * 14, w: 80 })),
  ];
  const { text, engine } = await extractPdfLayoutText(buildPdf(items));
  assert.equal(engine, "pdfjs-layout");
  const iL0 = text.indexOf(left[0]);
  const iLLast = text.indexOf(left[left.length - 1]);
  const iR0 = text.indexOf(right[0]);
  const iRLast = text.indexOf(right[right.length - 1]);
  assert.ok(iL0 >= 0 && iLLast >= 0 && iR0 >= 0 && iRLast >= 0, "thiếu dòng trong text:\n" + text);
  assert.ok(iL0 < iLLast && iLLast < iR0 && iR0 < iRLast, "thứ tự cột sai:\n" + text);
});

await t("PDF 1 cột: giữ nguyên thứ tự trên→dưới", async () => {
  const lines = ["Cau 1: Phan tu nao la axit?", "A. NaOH", "B. HCl", "C. NaCl"];
  const items = lines.map((text, i) => ({ text, x: 50, y: 800 - i * 14, w: 100 }));
  const { text, engine } = await extractPdfLayoutText(buildPdf(items));
  assert.equal(engine, "pdfjs-layout");
  for (let i = 0; i < lines.length - 1; i++) {
    assert.ok(text.indexOf(lines[i]) < text.indexOf(lines[i + 1]), "thứ tự dòng sai:\n" + text);
  }
});

await t("Tiêu đề trải ngang đứng đầu, rồi 2 cột", async () => {
  const left = ["Cau 1: Tong 1 + 1 bang?", "A. 1", "B. 2", "Dap an: B"];
  const right = ["Cau 2: Hieu 5 - 2 bang?", "A. 3", "B. 7", "Dap an: A"];
  const items = [
    { text: "DE THI KIEM TRA", x: 200, y: 820, w: 250 },
    ...left.map((text, i) => ({ text, x: 50, y: 800 - i * 14, w: 90 })),
    ...right.map((text, i) => ({ text, x: 320, y: 800 - i * 14, w: 90 })),
  ];
  const { text } = await extractPdfLayoutText(buildPdf(items));
  assert.ok(text.trim().startsWith("DE THI KIEM TRA"), "tiêu đề không đứng đầu:\n" + text);
  assert.ok(text.indexOf(left[left.length - 1]) < text.indexOf(right[0]), "cột không tách:\n" + text);
});

await t("PDF rác → ném lỗi để route quyết định fallback", async () => {
  await assert.rejects(() => extractPdfLayoutText(Buffer.from("not a pdf at all")));
});

console.log(`\n${passed} test pass`);
