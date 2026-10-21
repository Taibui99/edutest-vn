/**
 * PARSE-3 / PARSE-5 — xử lý công thức trong file Word.
 *
 * Word 2007+ lưu công thức dạng OMML (Office Math Markup Language — XML) trong
 * document.xml; file cũ hơn lưu Equation Editor 3.0 dưới dạng OLE nhị phân.
 * Trình bóc đề chỉ đọc chữ nên công thức trước đây bị bỏ qua IM LẶNG.
 *
 * PARSE-5 (theo yêu cầu giáo viên): ĐỌC công thức thành LaTeX và hiển thị ĐÚNG
 * như đề, thay vì ghi chú "[CÔNG THỨC — nhập tay]". Bộ chuyển đổi đệ quy hỗ trợ
 * các cấu trúc OMML thường gặp: r (chữ), sSub/sSup/sSubSup (chỉ số), sPre (chỉ
 * số trước), f (phân số), d (ngoặc), rad (căn), nary (tổng/tích phân), func
 * (hàm), m (ma trận). Công thức inline được bọc trong "$…$" để tầng hiển thị
 * render (KaTeX/MathJax) — và vẫn đọc được với AI.
 *
 * Zero-dep, thuần regex + scanner. Test: scripts/qa-omml.mjs.
 */

export const FORMULA_NOTE = "[CÔNG THỨC — nhập tay]";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Giải mã entity XML cơ bản (nội dung m:t có thể chứa &amp; &lt; &gt;). */
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Đoạn text trong m:t cần escape cho LaTeX (giữ nguyên ký tự toán Unicode). */
function escapeLatex(s: string): string {
  // Chỉ escape các ký tự LaTeX đặc biệt; giữ chữ, số, dấu, ký hiệu Unicode
  // (⋅, −, ×, °, λ, Δ…) — KaTeX/MathJax hiển thị tốt các ký hiệu này.
  return s.replace(/([\\{}$&#_^%~])/g, "\\$1");
}

/** Ánh xạ ký tự ngoặc OMML sang LaTeX (\left/\right). */
function delimTex(chr: string): string {
  switch (chr) {
    case "(":
      return "(";
    case ")":
      return ")";
    case "[":
      return "[";
    case "]":
      return "]";
    case "{":
      return "\\{";
    case "}":
      return "\\}";
    case "|":
      return "|";
    case "‖":
      return "\\|";
    default:
      return "";
  }
}

type Node = { tag: string; children: Node[]; text?: string; attrs?: Record<string, string> };

/**
 * Parser XML tối giản cho OMML: trả về cây node (kèm thuộc tính). Bỏ qua phần
 * không phải thẻ. Chỉ cần đủ để bóc m:t / cấu trúc m:* — không cần XML đầy đủ.
 */
function parseXml(xml: string): Node {
  const root: Node = { tag: "#root", children: [] };
  const stack: Node[] = [root];
  const re = /<([a-zA-Z][\w:.-]*)((?:"[^"]*"|[^>"/])*)(\/?)>|<\/([a-zA-Z][\w:.-]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) {
      const node: Node = { tag: m[1], children: [], attrs: parseAttrs(m[2]) };
      stack[stack.length - 1].children.push(node);
      if (!m[3]) stack.push(node);
    } else if (m[4]) {
      if (stack.length > 1) stack.pop();
    } else if (m[5] !== undefined) {
      const text = m[5];
      if (text) stack[stack.length - 1].children.push({ tag: "#text", children: [], text });
    }
  }
  return root;
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out[m[1]] = m[2];
  return out;
}

const child = (n: Node, tag: string): Node | undefined => n.children.find((c) => c.tag === tag);
const children = (n: Node, tag: string): Node[] => n.children.filter((c) => c.tag === tag);

/** Ghép text thô của các #text con (m:t chứa #text) — đã giải mã entity. */
function textOf(n: Node): string {
  let out = "";
  for (const c of n.children) if (c.tag === "#text") out += c.text ?? "";
  if (!out && n.text) out = n.text;
  return decodeXml(out);
}

/** Chuyển một nhánh OMML thành LaTeX. */
function toLatex(n: Node): string {
  switch (n.tag) {
    case "#root":
      return n.children.map(toLatex).join("");
    case "m:oMath":
    case "m:oMathPara":
      return n.children.map(toLatex).join("");
    case "m:r": {
      let s = "";
      for (const c of n.children) if (c.tag === "m:t") s += textOf(c);
      return escapeLatex(s);
    }
    case "m:t":
      return escapeLatex(textOf(n));
    case "m:sSub": {
      const e = toLatex(child(n, "m:e") ?? { tag: "x", children: [] });
      const sub = toLatex(child(n, "m:sub") ?? { tag: "x", children: [] });
      return `${e}_{${sub}}`;
    }
    case "m:sSup": {
      const e = toLatex(child(n, "m:e") ?? { tag: "x", children: [] });
      const sup = toLatex(child(n, "m:sup") ?? { tag: "x", children: [] });
      return `${e}^{${sup}}`;
    }
    case "m:sSubSup": {
      const e = toLatex(child(n, "m:e") ?? { tag: "x", children: [] });
      const sub = toLatex(child(n, "m:sub") ?? { tag: "x", children: [] });
      const sup = toLatex(child(n, "m:sup") ?? { tag: "x", children: [] });
      return `${e}_{${sub}}^{${sup}}`;
    }
    case "m:sPre": {
      const sub = child(n, "m:sub") ? toLatex(child(n, "m:sub") as Node) : "";
      const sup = child(n, "m:sup") ? toLatex(child(n, "m:sup") as Node) : "";
      const e = toLatex(child(n, "m:e") ?? { tag: "x", children: [] });
      return `{}_{${sub}}^{${sup}}${e}`;
    }
    case "m:f": {
      const num = toLatex(child(n, "m:num") ?? { tag: "x", children: [] });
      const den = toLatex(child(n, "m:den") ?? { tag: "x", children: [] });
      return `\\frac{${num}}{${den}}`;
    }
    case "m:d": {
      // Ngoặc: đọc m:begChr/m:endChr (mặc định "(" ")"). Ánh xạ ký tự đặc biệt.
      const dPr = child(n, "m:dPr");
      const beg = dPr ? child(dPr, "m:begChr")?.attrs?.["m:val"] : undefined;
      const end = dPr ? child(dPr, "m:endChr")?.attrs?.["m:val"] : undefined;
      const b = delimTex(beg ?? "(");
      const e = delimTex(end ?? ")");
      const inner = children(n, "m:e").map(toLatex).join(",");
      if (b === "" && e === "") return inner; // ngoặc ẩn
      return `\\left${b} ${inner} \\right${e}`;
    }
    case "m:rad": {
      const deg = child(n, "m:deg");
      const e = toLatex(child(n, "m:e") ?? { tag: "x", children: [] });
      const degTex = deg ? toLatex(deg) : "";
      return degTex ? `\\sqrt[${degTex}]{${e}}` : `\\sqrt{${e}}`;
    }
    case "m:nary": {
      const sub = child(n, "m:sub") ? toLatex(child(n, "m:sub") as Node) : "";
      const sup = child(n, "m:sup") ? toLatex(child(n, "m:sup") as Node) : "";
      const e = toLatex(child(n, "m:e") ?? { tag: "x", children: [] });
      const nPr = child(n, "m:naryPr");
      const chr = nPr?.attrs?.["m:chr"] ?? "\u2211";
      const op = chr === "\u220F" ? "\\prod" : chr === "\u222B" ? "\\int" : chr === "\u222C" ? "\\iint" : "\\sum";
      const bounds = (sub ? `_{${sub}}` : "") + (sup ? `^{${sup}}` : "");
      return `${op}${bounds} ${e}`;
    }
    case "m:func": {
      const fname = toLatex(child(n, "m:fName") ?? { tag: "x", children: [] });
      const e = toLatex(child(n, "m:e") ?? { tag: "x", children: [] });
      return `${fname} ${e}`;
    }
    case "m:m": {
      const rows = children(n, "m:mr").map((mr) =>
        children(mr, "m:e").map(toLatex).join(" & "),
      );
      return `\\begin{matrix}${rows.join(" \\\\ ")}\\end{matrix}`;
    }
    default: {
      // Node trung gian (m:e, m:num, m:sub…) hoặc không nhận biết → ghép con.
      return n.children.map(toLatex).join("");
    }
  }
}

/** Chuyển một khối OMML (m:oMath / m:oMathPara, kèm wrapper) thành LaTeX. */
export function ommlToLatex(ommlXml: string): string {
  const tree = parseXml(ommlXml);
  return toLatex(tree).trim();
}

/**
 * Thay MỌI khối <m:oMathPara>/<m:oMath> bằng text LaTeX bọc "$…$" — giữ nguyên
 * phần chữ còn lại của đoạn (không đụng cấu trúc → không phá text).
 * Trả về số công thức đã chuyển.
 */
export function injectOmmlText(xml: string): { xml: string; equations: number } {
  let equations = 0;
  const out = xml.replace(
    /<m:oMathPara(?:\s[^>]*)?>[\s\S]*?<\/m:oMathPara>|<m:oMath(?:\s[^>]*)?>[\s\S]*?<\/m:oMath>/g,
    (block) => {
      equations++;
      const tex = ommlToLatex(block);
      const payload = tex ? `$${tex}$` : FORMULA_NOTE;
      return `<w:r><w:t xml:space="preserve">${escapeXml(payload)}</w:t></w:r>`;
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
