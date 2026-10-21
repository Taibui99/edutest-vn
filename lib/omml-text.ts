/**
 * PARSE-3 — xử lý công thức trong file Word.
 *
 * Word 2007+ lưu công thức dạng OMML (XML) trong document.xml; file cũ hơn
 * lưu Equation Editor 3.0 dưới dạng OLE nhị phân. Trình bóc đề chỉ đọc chữ
 * nên công thức trước đây bị bỏ qua IM LẶNG.
 *
 * Quyết định (theo yêu cầu giáo viên): KHÔNG cố tự render công thức (dễ hỏng
 * cấu trúc / sai số) — thay mỗi khối công thức bằng một GHI CHÚ
 * "[CÔNG THỨC — nhập tay]" để giáo viên gõ lại khi duyệt. Ghi chú nằm đúng vị
 * trí trong câu nên parser rule gắn cảnh báo vào đúng câu đó.
 *
 * Zero-dep, thuần regex. Test: scripts/qa-omml.mjs.
 */

/** Ghi chú thay cho công thức — giáo viên nhập tay. */
export const FORMULA_NOTE = "[CÔNG THỨC — nhập tay]";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Thay MỌI khối <m:oMathPara>/<m:oMath> bằng <w:r><w:t> chứa ghi chú — giữ
 * nguyên phần chữ còn lại của đoạn (không đụng cấu trúc → không phá text).
 * Trả về số công thức đã thay.
 */
export function injectOmmlText(xml: string): { xml: string; equations: number } {
  let equations = 0;
  const out = xml.replace(
    /<m:oMathPara(?:\s[^>]*)?>[\s\S]*?<\/m:oMathPara>|<m:oMath(?:\s[^>]*)?>[\s\S]*?<\/m:oMath>/g,
    () => {
      equations++;
      return `<w:r><w:t xml:space="preserve">${escapeXml(FORMULA_NOTE)}</w:t></w:r>`;
    },
  );
  return { xml: out, equations };
}

/**
 * Đếm công thức Equation Editor 3.0 / MathType (OLE cũ) trong document.xml.
 * Object nhị phân đóng — không đọc được server-side; chỉ đếm để hướng dẫn
 * giáo viên mở bằng Word mới rồi lưu lại.
 */
export function countLegacyMathOle(documentXml: string): number {
  let n = 0;
  const re = /<(?:\w+:)?OLEObject\b[^>]*\bProgID\s*=\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(documentXml)) !== null) {
    if (/^(Equation\.|Equation\.DSMT4|MathType)/i.test(m[1])) n++;
  }
  return n;
}
