/**
 * Test thuần cho PARSE-3 — render OMML (công thức Word) + đếm Equation cũ.
 * Chạy: node scripts/qa-omml.mjs
 */
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { renderOmml, injectOmmlText, countLegacyMathOle } from "../lib/omml-text.ts";
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

t("phân số → (a)/(b)", () => {
  const xml = `<m:oMath><m:f><m:num>${RUN("a")}</m:num><m:den>${RUN("b")}</m:den></m:f></m:oMath>`;
  assert.equal(renderOmml(xml), "(a)/(b)");
});

t("phân số tuyến tính → a/b", () => {
  const xml = `<m:oMath><m:f><m:fPr><m:type m:val="lin"/></m:fPr><m:num>${RUN("1")}</m:num><m:den>${RUN("2")}</m:den></m:f></m:oMath>`;
  assert.equal(renderOmml(xml), "1/2");
});

t("căn bậc hai → √(x)", () => {
  const xml = `<m:oMath><m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${RUN("x")}</m:e></m:rad></m:oMath>`;
  assert.equal(renderOmml(xml), "√(x)");
});

t("căn bậc n → √[3](x)", () => {
  const xml = `<m:oMath><m:rad><m:deg>${RUN("3")}</m:deg><m:e>${RUN("x")}</m:e></m:rad></m:oMath>`;
  assert.equal(renderOmml(xml), "√[3](x)");
});

t("lũy thừa → b² (Unicode khi ngắn)", () => {
  const xml = `<m:oMath><m:sSup><m:e>${RUN("b")}</m:e><m:sup>${RUN("2")}</m:sup></m:sSup></m:oMath>`;
  assert.equal(renderOmml(xml), "b²");
});

t("lũy thừa dài → x^(...)", () => {
  const xml = `<m:oMath><m:sSup><m:e>${RUN("x")}</m:e><m:sup>${RUN("alpha")}</m:sup></m:sSup></m:oMath>`;
  assert.equal(renderOmml(xml), "x^(alpha)");
});

t("chỉ số dưới → a₁", () => {
  const xml = `<m:oMath><m:sSub><m:e>${RUN("a")}</m:e><m:sub>${RUN("1")}</m:sub></m:sSub></m:oMath>`;
  assert.equal(renderOmml(xml), "a₁");
});

t("mũ + chỉ số → x₁²", () => {
  const xml = `<m:oMath><m:sSubSup><m:e>${RUN("x")}</m:e><m:sub>${RUN("1")}</m:sub><m:sup>${RUN("2")}</m:sup></m:sSubSup></m:oMath>`;
  assert.equal(renderOmml(xml), "x₁²");
});

t("tổng ∑ với cận", () => {
  const xml = `<m:oMath><m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${RUN("i=1")}</m:sub><m:sup>${RUN("n")}</m:sup><m:e>${RUN("a")}</m:e></m:nary></m:oMath>`;
  assert.equal(renderOmml(xml), "∑_i=1^n a");
});

t("ngoặc theo phân cách → (a, b)", () => {
  const xml = `<m:oMath><m:d><m:e>${RUN("a")}</m:e><m:e>${RUN("b")}</m:e></m:d></m:oMath>`;
  assert.equal(renderOmml(xml), "(a, b)");
});

t("ngoặc vuông begChr/endChr → [a]", () => {
  const xml = `<m:oMath><m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/></m:dPr><m:e>${RUN("a")}</m:e></m:d></m:oMath>`;
  assert.equal(renderOmml(xml), "[a]");
});

t("ma trận → [a, b; c, d]", () => {
  const xml = `<m:oMath><m:m><m:mr><m:e>${RUN("a")}</m:e><m:e>${RUN("b")}</m:e></m:mr><m:mr><m:e>${RUN("c")}</m:e><m:e>${RUN("d")}</m:e></m:mr></m:m></m:oMath>`;
  assert.equal(renderOmml(xml), "[a, b; c, d]");
});

t("hàm sin → sin(x)", () => {
  const xml = `<m:oMath><m:func><m:fName>${RUN("sin")}</m:fName><m:e>${RUN("x")}</m:e></m:func></m:oMath>`;
  assert.equal(renderOmml(xml), "sin(x)");
});

t("công thức giữa chữ — inject vào w:t", () => {
  const p = `<w:p><w:r><w:t>Nghiệm </w:t></w:r><m:oMath><m:sSup><m:e>${RUN("x")}</m:e><m:sup>${RUN("2")}</m:sup></m:sSup></m:oMath><w:r><w:t> đúng</w:t></w:r></w:p>`;
  const { xml, equations } = injectOmmlText(p);
  assert.equal(equations, 1);
  assert.ok(xml.includes("x²"));
  assert.ok(xml.includes("Nghiệm"));
  assert.ok(xml.includes("đúng"));
  assert.ok(!xml.includes("<m:oMath"));
});

t("inject oMathPara (khối nhiều công thức)", () => {
  const p = `<m:oMathPara><m:oMath><m:sSup><m:e>${RUN("y")}</m:e><m:sup>${RUN("3")}</m:sup></m:sSup></m:oMath></m:oMathPara>`;
  const { xml, equations } = injectOmmlText(p);
  assert.equal(equations, 1);
  assert.ok(xml.includes("y³"));
});

t("node lạ không mất chữ (recursive)", () => {
  const xml = `<m:oMath><m:box><m:e>${RUN("giữ")}</m:e></m:box></m:oMath>`;
  assert.equal(renderOmml(xml), "giữ");
});

t("đếm Equation Editor 3.0 (Equation.DSMT4)", () => {
  const doc =
    `<w:p><w:r><w:object><v:shape/>` +
    `<o:OLEObject ProgID="Equation.DSMT4" ShapeID="_x1"/></w:object></w:r></w:p>` +
    `<w:p><w:r><w:object><o:OLEObject ProgID="Equation.3" ShapeID="_x2"/></w:object></w:r></w:p>` +
    `<w:p><w:r><w:object><o:OLEObject ProgID="Word.Picture.8" ShapeID="_x3"/></w:object></w:r></w:p>`;
  assert.equal(countLegacyMathOle(doc), 2);
});

t("tích hợp: docx có công thức → text + đếm + issues", () => {
  const docXml =
    `<?xml version="1.0"?><w:document xmlns:w="x" xmlns:m="y"><w:body>` +
    `<w:p><w:r><w:t>Câu 1: Giải phương trình </w:t></w:r>` +
    `<m:oMath><m:f><m:num>${RUN("1")}</m:num><m:den>${RUN("2")}</m:den></m:f></m:oMath>` +
    `<w:r><w:t> = </w:t></w:r>` +
    `<m:oMath><m:sSup><m:e>${RUN("x")}</m:e><m:sup>${RUN("2")}</m:sup></m:sSup></m:oMath>` +
    `<w:r><w:t>?</w:t></w:r></w:p>` +
    `<w:p><w:r><w:object><o:OLEObject ProgID="Equation.3" ShapeID="_x1"/></w:object></w:r></w:p>` +
    `</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(docXml, "utf8"));
  const out = extractDocxText(zip.toBuffer());
  assert.equal(out.equations, 2);
  assert.equal(out.legacyEquations, 1);
  assert.ok(out.text.includes("(1)/(2)"), out.text);
  assert.ok(out.text.includes("x²"), out.text);
});

process.exitCode = process.exitCode || 0;
console.log(`\n${passed}/18 QA-OMML xanh`);
