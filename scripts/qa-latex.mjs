/**
 * Test thuần cho PARSE-7 — render LaTeX trên web (KaTeX).
 * Kiểm tra tách `$…$` / `$$…$$` / `\(…\)` / `\[…\]`, escape HTML (chống XSS),
 * công thức sai cú pháp không làm vỡ trang.
 * Chạy: node scripts/qa-latex.mjs
 */
import assert from "node:assert/strict";
import { hasMath, mathToHtml, escapeHtml } from "../lib/latex.ts";

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

const katexCount = (html) => (html.match(/class="katex/g) ?? []).length;

t("chữ thuần: giữ nguyên, không sinh KaTeX", () => {
  const html = mathToHtml("Nhiệt lượng cần cung cấp");
  assert.equal(html, "Nhiệt lượng cần cung cấp");
  assert.equal(katexCount(html), 0);
});

t("chữ thuần: escape HTML để không chèn được thẻ", () => {
  const html = mathToHtml('<img src=x onerror="alert(1)">');
  assert.ok(!html.includes("<img"), html);
  assert.ok(html.includes("&lt;img"));
  assert.equal(html, "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

t("escapeHtml xử lý đủ 5 ký tự", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

t("inline $…$ → KaTeX (có MathML)", () => {
  const html = mathToHtml("Ta có $x^{2}+1$ đúng");
  assert.ok(html.includes("Ta có "), html);
  assert.ok(html.includes("đúng"));
  assert.ok(katexCount(html) >= 1);
  assert.ok(html.includes("<math"), "cần MathML cho trình đọc màn hình");
});

t("$$…$$ → chế độ khối (katex-display)", () => {
  const html = mathToHtml("$$\\frac{a}{b}$$");
  assert.ok(html.includes("katex-display"), html);
});

t("\\(…\\) và \\[…\\] cũng được nhận", () => {
  const inline = mathToHtml("giá trị \\(v=10\\) m/s");
  assert.ok(katexCount(inline) >= 1, inline);
  const block = mathToHtml("\\[F=ma\\]");
  assert.ok(block.includes("katex-display"), block);
});

t("nhiều công thức liên tiếp trong 1 câu", () => {
  const html = mathToHtml("$a$ và $b$ và $c$");
  assert.ok(katexCount(html) >= 3, String(katexCount(html)));
});

t("công thức sai cú pháp: không ném lỗi, vẫn render phần chữ", () => {
  const html = mathToHtml("A $\\frac{1}{$ B");
  assert.ok(html.includes("A "), html);
  assert.ok(html.includes(" B"));
});

t("xuống dòng thành <br/>", () => {
  assert.equal(mathToHtml("dòng 1\ndòng 2"), "dòng 1<br/>dòng 2");
});

t("null/undefined/rỗng → chuỗi rỗng", () => {
  assert.equal(mathToHtml(null), "");
  assert.equal(mathToHtml(undefined), "");
  assert.equal(mathToHtml(""), "");
});

t("hasMath phân biệt chữ thường và có công thức", () => {
  assert.equal(hasMath("không có công thức"), false);
  assert.equal(hasMath("$x$"), true);
  assert.equal(hasMath("\\(x\\)"), true);
  assert.equal(hasMath("\\[x\\]"), true);
  assert.equal(hasMath(null), false);
  assert.equal(hasMath(""), false);
});

t("$ không đóng: không treo, trả về chữ đã escape", () => {
  const html = mathToHtml("giá 100$ và <b>đậm</b>");
  assert.ok(!html.includes("<b>"), html);
  assert.ok(html.includes("100$"));
});

console.log(`\n${passed}/12 QA-LATEX xanh`);
