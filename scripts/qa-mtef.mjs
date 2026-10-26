/**
 * Test cho PARSE-6 — giải mã MathType MTEF v5 → LaTeX.
 *  - MTEF tổng hợp (không cần file Word): char, chỉ số dưới/trên, phân số, ngoặc.
 *  - CFB thật (fixture `scripts/fixtures/mtef-delta-u.bin`, stream "Equation Native").
 *  - Tích hợp extractDocxText: OLE → `$…$`, decode lỗi → ghi chú nhập tay.
 * Chạy: node scripts/qa-mtef.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mtefToLatex } from "../lib/mtef-latex.ts";
import { readCfbStreams } from "../lib/cfb.ts";
import { extractDocxText } from "../lib/exam-docx.ts";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

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

const header = Buffer.from([5, 1, 0, 7, 4, ...Buffer.from("DSMT7\0", "latin1"), 0]);
const END = 0;
const line = (...bytes) => [1, 0, ...bytes, END];
const char = (code, typeface = 0) => [2, 0, 0x80 + typeface, code & 0xff, code >> 8];
const tmpl = (sel, variation, ...slots) => [3, 0, sel, variation, 0, ...slots, END];
const stream = (body) => Buffer.concat([Buffer.from(header), Buffer.from(body.flat(Infinity))]);
const wrap28 = (buf) => Buffer.concat([Buffer.alloc(28), buf]);

t("CHAR: ΔU=A+Q", () => {
  const tex = mtefToLatex(
    stream(line(char(0x0394), char(0x55), char(0x3d), char(0x41), char(0x2b), char(0x51))),
  );
  assert.equal(tex, "ΔU=A+Q");
});

t("CHAR: bỏ ký tự Private Use (MT Extra)", () => {
  const tex = mtefToLatex(stream(line(char(0x54), char(0xef02), char(0x28))));
  assert.equal(tex, "T(");
});

t("TMPL: chỉ số dưới", () => {
  const tex = mtefToLatex(stream(line(char(0x6d), tmpl(27, 0, line(char(0x31))))));
  assert.equal(tex, "m_{1}");
});

t("TMPL: chỉ số trên", () => {
  const tex = mtefToLatex(stream(line(char(0x74), tmpl(28, 0, line(char(0x6f))))));
  assert.equal(tex, "t^{o}");
});

t("TMPL: vừa dưới vừa trên", () => {
  const tex = mtefToLatex(
    stream(line(char(0x78), tmpl(29, 0, line(char(0x31)), line(char(0x32))))),
  );
  assert.equal(tex, "x_{1}^{2}");
});

t("TMPL: phân số", () => {
  const tex = mtefToLatex(
    stream(line(char(0x51), char(0x3d), tmpl(11, 0, line(char(0x51)), line(char(0x6d))))),
  );
  assert.equal(tex, "Q=\\frac{Q}{m}");
});

t("TMPL: ngoặc", () => {
  const tex = mtefToLatex(stream(line(tmpl(1, 3, line(char(0x31))))));
  assert.equal(tex, "\\left(1\\right)");
});

t("header 28-byte header OLE (padding) vẫn tìm đúng MTEF", () => {
  const tex = mtefToLatex(wrap28(stream(line(char(0x41)))));
  assert.equal(tex, "A");
});

t("dữ liệu hỏng → chuỗi rỗng, không ném lỗi", () => {
  assert.equal(mtefToLatex(Buffer.from(header)), "");
  assert.equal(mtefToLatex(Buffer.alloc(0)), "");
});

t("CFB thật: đọc được stream Equation Native", () => {
  const buf = readFileSync(new URL("./fixtures/mtef-delta-u.bin", import.meta.url));
  const streams = readCfbStreams(buf);
  assert.ok(streams.has("Equation Native"));
  assert.equal(mtefToLatex(buf), "ΔU=A+Q");
});

function makeDocx(withRels, withEmbedding) {
  const zip = new AdmZip();
  zip.addFile(
    "word/document.xml",
    Buffer.from(
      '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="w" xmlns:o="o" xmlns:r="r"><w:body>' +
        '<w:p><w:r><w:object><o:OLEObject ProgID="Equation.DSMT4" r:id="rId5"/></w:object></w:r>' +
        '<w:r><w:t xml:space="preserve"> J</w:t></w:r></w:p></w:body></w:document>',
    ),
  );
  if (withRels) {
    zip.addFile(
      "word/_rels/document.xml.rels",
      Buffer.from(
        '<Relationships xmlns="r"><Relationship Id="rId5" Target="embeddings/oleObject1.bin"/></Relationships>',
      ),
    );
  }
  if (withEmbedding) {
    zip.addFile(
      "word/embeddings/oleObject1.bin",
      readFileSync(new URL("./fixtures/mtef-delta-u.bin", import.meta.url)),
    );
  }
  return zip.toBuffer();
}

t("docx: OLE MathType → $LaTeX$ trong text", () => {
  const out = extractDocxText(makeDocx(true, true));
  assert.ok(out.text.includes("$ΔU=A+Q$"), out.text);
  assert.equal(out.mtefEquations, 1);
  assert.equal(out.legacyEquations, 0);
});

t("docx: OLE không giải mã được → ghi chú nhập tay", () => {
  const out = extractDocxText(makeDocx(false, false));
  assert.ok(out.text.includes("[CÔNG THỨC — nhập tay]"), out.text);
  assert.equal(out.mtefEquations, 0);
  assert.equal(out.legacyEquations, 1);
});

console.log(`\n${passed} passed`);
