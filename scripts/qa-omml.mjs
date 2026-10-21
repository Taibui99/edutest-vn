/**
 * Test thuần cho PARSE-3 — phát hiện công thức Word (OMML) và chèn ghi chú
 * "[CÔNG THỨC — nhập tay]" (không render), + đếm Equation Editor 3.0 cũ.
 * Chạy: node scripts/qa-omml.mjs
 */
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { injectOmmlText, countLegacyMathOle, FORMULA_NOTE } from "../lib/omml-text.ts";
import { extractDocxText } from "../lib/exam-docx.ts";
import { parseExamText } from "../lib/exam-parse.ts";

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

t("docx: lựa chọn nằm cùng dòng câu hỏi (tab) → tách đủ 4 đáp án", () => {
  const P = (s) => `<w:p><w:r><w:t xml:space="preserve">${s}</w:t></w:r></w:p>`;
  const docXml =
    `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>` +
    P("ĐỀ THI") +
    P("Câu 1:\tĐộng năng là gì?\tA. mv\tB. 1/2mv2\tC. mgh\tD. mv/2") +
    P("Đáp án: B") +
    `</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(docXml, "utf8"));
  const out = extractDocxText(zip.toBuffer());
  const r = parseExamText(out.text, { docKey: out.key });
  assert.equal(r.payload.questions.length, 1);
  assert.equal(r.payload.questions[0].options.length, 4, JSON.stringify(r.payload.questions[0].options));
  assert.equal(r.payload.questions[0].answer, "B");
});

t("docx: câu hỏi + lựa chọn trong bảng → đọc đúng 2 câu, đủ đáp án", () => {
  const P = (s) => `<w:p><w:r><w:t xml:space="preserve">${s}</w:t></w:r></w:p>`;
  const tbl =
    `<w:tbl><w:tr><w:tc>${P("Câu 2: Đơn vị công suất?")}</w:tc></w:tr>` +
    `<w:tr><w:tc>${P("A. Jun")}${P("B. Oát")}</w:tc><w:tc>${P("C. Niuton")}${P("D. Mét")}</w:tc></w:tr></w:tbl>`;
  const docXml =
    `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>` +
    P("Câu 1: Động năng là gì?") +
    P("A. a") + P("B. b") + P("C. c") + P("D. d") + P("Đáp án: B") +
    tbl + P("Đáp án: B") +
    `</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(docXml, "utf8"));
  const out = extractDocxText(zip.toBuffer());
  const r = parseExamText(out.text, { docKey: out.key });
  assert.equal(r.payload.questions.length, 2, JSON.stringify(r.payload.questions.map((q) => q.question)));
  assert.equal(r.payload.questions[1].options.length, 4, JSON.stringify(r.payload.questions[1].options));
  assert.equal(r.payload.questions[1].answer, "B");
});

process.exitCode = process.exitCode || 0;
console.log(`\n${passed}/7 QA-OMML xanh`);