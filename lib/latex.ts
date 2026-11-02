import katex from "katex";

/**
 * PARSE-7 — Chuyển văn bản có công thức LaTeX (`$…$`, `$$…$$`, `\(…\)`,
 * `\[…\]`) thành HTML an toàn để render.
 *
 * Vì sao KaTeX (không phải MathJax):
 *  - Render ra HTML + CSS kèm MathML → hiển thị được trên MỌI thiết bị (iOS 15,
 *    Android cũ), không cần JS phía client, không lỗi hydration.
 *  - `throwOnError: false` → công thức sai cú pháp hiện chữ đỏ chứ KHÔNG làm
 *    vỡ trang.
 *
 * An toàn: phần chữ thường escape HTML thủ công; KaTeX chạy với `trust: false`
 * nên không render `\href`/`\htmlClass` độc hại.
 *
 * Bảng số liệu (IMG-free): các dòng "| ô | ô |" do bộ đọc DOCX sinh ra được
 * render thành <table> thật — giáo viên không phải chèn ảnh bảng.
 */

const MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function renderKaTeX(tex: string, displayMode: boolean): string {
  const clean = tex.trim();
  if (!clean) return "";
  try {
    return katex.renderToString(clean, {
      throwOnError: false,
      displayMode,
      output: "htmlAndMathml",
      strict: false,
      trust: false,
      errorColor: "#dc2626",
    });
  } catch {
    // KaTeX hiếm khi ném lỗi khi throwOnError=false, nhưng chặn mọi rủi ro.
    return `<span style="color:#dc2626">${escapeHtml(clean)}</span>`;
  }
}

/** Có công thức hay không (tránh xử lý thừa với câu hỏi chữ thuần). */
export function hasMath(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.includes("$") || text.includes("\\(") || text.includes("\\[");
}

/** Có bảng số liệu "| … |" hay không. */
export function hasTable(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.split("\n").some((line) => TABLE_ROW_RE.test(line));
}

/** Render chữ + công thức (giữ nguyên "\n" cho caller tự quyết định <br/>). */
function renderInline(value: string): string {
  const out: string[] = [];
  let last = 0;
  MATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MATH_RE.exec(value)) !== null) {
    if (m.index > last) out.push(escapeHtml(value.slice(last, m.index)));
    const token = m[0];
    const isBlock = token.startsWith("$$") || token.startsWith("\\[");
    const body = isBlock ? token.slice(2, -2) : token.slice(1, -1);
    out.push(renderKaTeX(body, isBlock));
    last = m.index + token.length;
  }
  if (last < value.length) out.push(escapeHtml(value.slice(last)));
  return out.join("");
}

function tableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function renderTable(rows: string[][]): string {
  const width = Math.max(1, ...rows.map((r) => r.length));
  const cell = (tag: "th" | "td", v: string | undefined) => `<${tag}>${renderInline(v ?? "")}</${tag}>`;
  const head = `<thead><tr>${Array.from({ length: width }, (_, j) => cell("th", rows[0]?.[j])).join("")}</tr></thead>`;
  const body =
    rows.length > 1
      ? `<tbody>${rows
          .slice(1)
          .map((r) => `<tr>${Array.from({ length: width }, (_, j) => cell("td", r[j])).join("")}</tr>`)
          .join("")}</tbody>`
      : "";
  return `<div class="mt-table-wrap"><table class="mt-table">${head}${body}</table></div>`;
}

/**
 * Đổi văn bản có `$…$` / hàng bảng `| … |` → HTML an toàn.
 * Dùng cho chỗ cần `dangerouslySetInnerHTML`.
 */
export function mathToHtml(text: string | null | undefined): string {
  const value = text ?? "";
  if (!value) return "";
  const withTable = value.includes("|") && hasTable(value);
  if (!hasMath(value) && !withTable) return escapeHtml(value).replace(/\n/g, "<br/>");

  const lines = value.split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  const flushText = () => {
    if (!buf.length) return;
    out.push(renderInline(buf.join("\n")).replace(/\n/g, "<br/>"));
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    if (!TABLE_ROW_RE.test(lines[i])) {
      buf.push(lines[i]);
      continue;
    }
    flushText();
    const rows: string[][] = [];
    while (i < lines.length && TABLE_ROW_RE.test(lines[i])) rows.push(tableRow(lines[i++]));
    i--;
    out.push(renderTable(rows));
  }
  flushText();
  return out.join("");
}
