/**
 * Test thuần cho PARSE-3 — phát hiện công thức Word (OMML) và chèn ghi chú
 * "[CÔNG THỨC — nhập tay]" (không render), + đếm Equation Editor 3.0 cũ.
 * Chạy: node scripts/qa-omml.mjs
 */
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { injectOmmlText, countLegacyMathOle, FORMULA_NOTE } from "../lib/omml-text.ts";
import { extractDocxText } from "../lib/exam-docx.ts";

let passed = 0;
const t = (name, fn) => {
  try {
    fn();
    passed++;
    console.log("  ok  " + name);
  } catch (e) {
    console.log("  FAIL " + name + " :: " + e.message);
    process.exitCode = 1;
  }
};

const RUN = (txt) => `<m:r><m:t>${txt}</m:t></m:r>`;

t("thay 1 công thức inline bằng ghi chú, giữ chữ xung quanh", () => {
  const p = `<w:p><w:r><w:t>Nghiệm </w:t></w:r><m:oMath><m:sSup><m:e>${RUN("x")}</m:e><m:sup>${RUN("2")}</m:sup></m:sSup></m:oMath><w:r><w:t> đúng</w:t></w:r></w:p>`;
  const { xml, equations } = injectOmmlText(p);
  assert.equal(equations, 1);
  assert.ok(xml.includes(FORMULA_NOTE));
  assert.ok(xml.includes("Nghiệm"));
  assert.ok(xml.includes("đúng"));
  assert.ok(!xml.includes("<m:oMath"));
});

t("thay oMathPara (khối nhiều công thức)", () => {
  const p = `<m:oMathPara><m:oMath><m:f><m:num>${RUN("a")}</m:num><m:den>${RUN("b")}</m:den></m:f></m:oMath></m:oMathPara>`;
  const { xml, equations } = injectOmmlText(p);
  assert.equal(equations, 1);
  assert.ok(xml.includes(FORMULA_NOTE));
});

t("nhiều công thức trong 1 đoạn → đếm đủ", () => {
  const p = `<w:p><m:oMath>${RUN("a")}</m:oMath><w:r><w:t> + </w:t></w:r><m:oMath>${RUN("b")}</m:oMath></w:p>`;
  const { equations } = injectOmmlText(p);
  assert.equal(equations, 2);
});

t("đếm Equation Editor 3.0 (Equation.DSMT4)", () => {
  const doc =
    `<w:p><w:r><w:object><v:shape/>` +
    `<o:OLEObject ProgID="Equation.DSMT4" ShapeID="_x1"/></w:object></w:r></w:p>` +
    `<w:p><w:r><w:object><o:OLEObject ProgID="Equation.3" ShapeID="_x2"/></w:object></w:r></w:p>` +
    `<w:p><w:r><w:object><o:OLEObject ProgID="Word.Picture.8" ShapeID="_x3"/></w:object></w:r></w:p>`;
  assert.equal(countLegacyMathOle(doc), 2);
});

t("tích hợp: docx có công thức → text có ghi chú, đếm equations + legacy", () => {
  const docXml =
    `<?xml version="1.0"?><w:document xmlns:w="x" xmlns:m="y"><w:body>` +
    `<w:p><w:r><w:t>Câu 1: Giải phương trình </w:t></w:r>` +
    `<m:oMath><m:f><m:num>${RUN("1")}</m:num><m:den>${RUN("2")}</m:den></m:f></m:oMath>` +
    `<w:r><w:t> = 0?</w:t></w:r></w:p>` +
    `<w:p><w:r><w:object><o:OLEObject ProgID="Equation.3" ShapeID="_x1"/></w:object></w:r></w:p>` +
    `</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(docXml, "utf8"));
  const out = extractDocxText(zip.toBuffer());
  assert.equal(out.equations, 1);
  assert.equal(out.legacyEquations, 1);
  assert.ok(out.text.includes(FORMULA_NOTE), out.text);
  assert.ok(out.text.includes("Giải phương trình"));
});

process.exitCode = process.exitCode || 0;
console.log(`\n${passed}/5 QA-OMML xanh`);
