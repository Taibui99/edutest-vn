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
 */

const MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;

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

/**
 * Đổi văn bản có `$…$` → HTML an toàn (chữ escape, công thức KaTeX).
 * Dùng cho chỗ cần `dangerouslySetInnerHTML`.
 */
export function mathToHtml(text: string | null | undefined): string {
  const value = text ?? "";
  if (!value) return "";
  if (!hasMath(value)) return escapeHtml(value).replace(/\n/g, "<br/>");
  const out: string[] = [];
  let last = 0;
  MATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MATH_RE.exec(value)) !== null) {
    if (m.index > last) {
      out.push(escapeHtml(value.slice(last, m.index)).replace(/\n/g, "<br/>"));
    }
    const token = m[0];
    const isBlock = token.startsWith("$$") || token.startsWith("\\[");
    const body = isBlock ? token.slice(2, -2) : token.slice(1, -1);
    out.push(renderKaTeX(body, isBlock));
    last = m.index + token.length;
  }
  if (last < value.length) {
    out.push(escapeHtml(value.slice(last)).replace(/\n/g, "<br/>"));
  }
  return out.join("");
}
