/**
 * PARSE-3 — OMML (công cụ công thức của Word) → chữ dễ đọc.
 *
 * Word 2007+ lưu công thức là OMML (XML) trong document.xml. Trình bóc
 * đề cũ chỉ đọc <w:t> → công thức BỊ IM LẶNG BỎ QUA, AI và parser rule
 * đều mất dữ liệu. Ở đây tự render subset phổ biến của OMML sang Unicode:
 *   phân số (a)/(b) · căn √(x) · lũy thừa b² · chỉ số a₁ · ∑ ∫ · ngoặc
 *   · hàm sin(x) · lim_(x→0) · ma trận [a, b; c, d].
 *
 * Zero-dep, thuần hàm, regex + duyệt XML kiểu depth-count (đúng triết lý
 * repo). Node lạ (m:*Pr, w:*) bỏ qua; nội dung chưa nhận diện được vẫn
 * được render đệ quy nên KHÔNG BAO GIỜ mất chữ. Test: scripts/qa-omml.mjs.
 */

const SUP_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "₌", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};
const SUB_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ",
  o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

type El = { name: string; attrs: string; inner: string; end: number };

function unescapeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Chữ in nghiêng toán (U+1D400–1D6A3) + chữ số toán (U+1D7CE–1D7FF) → ASCII. */
function mapMathAlnum(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x1d400 && cp <= 0x1d6a3) {
      const pos = (cp - 0x1d400) % 52;
      out += pos < 26 ? String.fromCharCode(65 + pos) : String.fromCharCode(97 + pos - 26);
    } else if (cp >= 0x1d7ce && cp <= 0x1d7ff) {
      out += String.fromCharCode(48 + ((cp - 0x1d7ce) % 10));
    } else {
      out += ch;
    }
  }
  return out;
}

/** Đọc 1 phần tử có closing tag khớp (depth-count); trả text thuần nếu không có tag. */
function nextEl(xml: string, from: number, to: number): El | { text: string; end: number } | null {
  if (from >= to) return null;
  const lt = xml.indexOf("<", from);
  if (lt < 0 || lt >= to) {
    const text = xml.slice(from, to);
    return text ? { text, end: to } : null;
  }
  if (lt > from) return { text: xml.slice(from, lt), end: lt };
  if (xml.startsWith("<!--", lt)) {
    const end = xml.indexOf("-->", lt);
    return end < 0 ? null : nextEl(xml, end + 3, to);
  }
  const gt = xml.indexOf(">", lt);
  if (gt < 0 || gt >= to) return null;
  const raw = xml.slice(lt + 1, gt);
  if (raw.startsWith("/")) return null; // close của parent — caller dừng
  if (raw.startsWith("!") || raw.startsWith("?")) return nextEl(xml, gt + 1, to);
  if (raw.endsWith("/")) {
    const sp = raw.search(/\s/);
    const name = sp >= 0 ? raw.slice(0, sp) : raw;
    return { name, attrs: raw.slice(name.length), inner: "", end: gt + 1 };
  }
  const sp = raw.search(/\s/);
  const name = sp >= 0 ? raw.slice(0, sp) : raw;
  let depth = 1;
  let pos = gt + 1;
  while (pos < to) {
    const n2 = xml.indexOf("<", pos);
    if (n2 < 0 || n2 >= to) return { name, attrs: raw.slice(name.length), inner: xml.slice(gt + 1, to), end: to };
    const g2 = xml.indexOf(">", n2);
    if (g2 < 0 || g2 >= to) return { name, attrs: raw.slice(name.length), inner: xml.slice(gt + 1, to), end: to };
    const t2 = xml.slice(n2 + 1, g2);
    if (t2.startsWith("/")) {
      depth--;
      if (depth === 0) return { name, attrs: raw.slice(name.length), inner: xml.slice(gt + 1, n2), end: g2 + 1 };
    } else if (!t2.startsWith("!") && !t2.startsWith("?") && !t2.endsWith("/")) {
      depth++;
    }
    pos = g2 + 1;
  }
  return { name, attrs: raw.slice(name.length), inner: xml.slice(gt + 1, to), end: to };
}

function children(xml: string): El[] {
  const out: El[] = [];
  let pos = 0;
  while (pos < xml.length) {
    const el = nextEl(xml, pos, xml.length);
    if (!el) break;
    if ("text" in el) {
      pos = el.end;
      continue;
    }
    out.push(el);
    pos = el.end;
  }
  return out;
}

function kid(list: El[], name: string): El | undefined {
  return list.find((e) => e.name === name || e.name.split(":").pop() === name);
}

function attrVal(attrs: string, key: string): string | null {
  const m = new RegExp(`(?:m:)?${key}\\s*=\\s*"([^"]*)"`).exec(attrs);
  return m ? unescapeXml(m[1]) : null;
}

function fmtScript(base: string, script: string, sup: boolean): string {
  if (!script) return base;
  const map = sup ? SUP_MAP : SUB_MAP;
  if (script.length <= 8 && [...script].every((c) => map[c])) {
    return base + [...script].map((c) => map[c]).join("");
  }
  return sup ? `${base}^(${script})` : `${base}_(${script})`;
}

function renderList(xml: string): string {
  let out = "";
  let pos = 0;
  while (pos < xml.length) {
    const el = nextEl(xml, pos, xml.length);
    if (!el) break;
    if ("text" in el) {
      // Bỏ whitespace formatting giữa các node; giữ chữ thật (hiếm, ngoài m:t).
      if (el.text.trim()) out += unescapeXml(el.text);
      pos = el.end;
      continue;
    }
    out += renderNode(el);
    pos = el.end;
  }
  return out;
}

function renderNode(el: El): string {
  const local = el.name.split(":").pop() ?? el.name;
  const ns = el.name.includes(":") ? el.name.split(":")[0] : "";

  // Bỏ thuộc tính/rất nhiều node định dạng.
  if (ns === "w" || local.endsWith("Pr") || local === "ctrlPr" || local === "argPr") return "";
  if (local === "t") return mapMathAlnum(unescapeXml(el.inner));
  if (local === "r" || local === "nor" || local === "box" || local === "borderBox" || local === "phant") {
    return renderList(el.inner);
  }

  const kids = children(el.inner);
  const r = (name: string): string => {
    const k = kid(kids, name);
    return k ? renderList(k.inner) : "";
  };
  const rawKid = (name: string): El | undefined => kid(kids, name);

  switch (local) {
    case "oMath":
    case "oMathPara":
      return renderList(el.inner);
    case "f": {
      const fp = rawKid("fPr");
      const type = fp ? attrVal(kid(children(fp.inner), "type")?.attrs ?? "", "val") : null;
      const num = r("num") || " ";
      const den = r("den") || " ";
      return type === "lin" ? `${num}/${den}` : `(${num})/(${den})`;
    }
    case "rad": {
      const degHide = !!rawKid("radPr") && /degHide/.test(rawKid("radPr")!.inner);
      const e = r("e");
      const deg = r("deg");
      if (degHide || !deg) return `√(${e})`;
      return `√[${deg}](${e})`;
    }
    case "sSup":
      return fmtScript(r("e"), r("sup"), true);
    case "sSub":
      return fmtScript(r("e"), r("sub"), false);
    case "sSubSup":
      return fmtScript(fmtScript(r("e"), r("sub"), false), r("sup"), true);
    case "sPre":
      return fmtScript(fmtScript("", r("sub"), false), r("sup"), true) + r("e");
    case "nary": {
      const np = rawKid("naryPr");
      let chr = "∫";
      if (np) {
        const c = kid(children(np.inner), "chr");
        if (c) chr = attrVal(c.attrs, "val") ?? chr;
      }
      const sub = r("sub");
      const sup = r("sup");
      const body = r("e");
      const lim = (sub ? `_${sub}` : "") + (sup ? `^${sup}` : "");
      return `${chr}${lim} ${body}`.trim();
    }
    case "d": {
      const dp = rawKid("dPr");
      let beg = "(";
      let end = ")";
      let sep = ",";
      if (dp) {
        const dk = children(dp.inner);
        beg = attrVal(kid(dk, "begChr")?.attrs ?? "", "val") ?? beg;
        end = attrVal(kid(dk, "endChr")?.attrs ?? "", "val") ?? end;
        sep = attrVal(kid(dk, "sepChr")?.attrs ?? "", "val") ?? sep;
      }
      const parts = kids.filter((k) => (k.name.split(":").pop() ?? "") === "e").map((k) => renderList(k.inner));
      if (!parts.length) return `${beg}${end}`;
      // OMML mặc định separators là dấu phẩy + khoảng trắng: (a, b).
      const sepStr = sep === "," ? ", " : ` ${sep} `;
      return `${beg}${parts.join(sepStr)}${end}`;
    }
    case "acc": {
      const ap = rawKid("accPr");
      const c = ap ? kid(children(ap.inner), "chr") : undefined;
      const chr = (c && attrVal(c.attrs, "val")) || "̂";
      const base = r("e");
      const cp = chr.codePointAt(0) ?? 0;
      const combining = (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x20d0 && cp <= 0x20ff);
      return combining ? base + chr : `${chr}${base}`;
    }
    case "bar": {
      const bp = rawKid("barPr");
      const pos = bp ? (attrVal(kid(children(bp.inner), "pos")?.attrs ?? "", "val") ?? "top") : "top";
      const base = r("e");
      return base + (pos === "bot" ? "̲" : "̅");
    }
    case "func": {
      const name = r("fName");
      const e = r("e");
      return name ? `${name}(${e})` : e;
    }
    case "limLow":
      return r("e") + (r("lim") ? `_${r("lim")}` : "");
    case "limUpp":
      return r("e") + (r("lim") ? `^${r("lim")}` : "");
    case "groupChr":
      // Nhãn nhóm (over/underbrace) chỉ có ký hiệu trang trí — giữ nội dung.
      return r("e");
    case "m": {
      const rows = kids.filter((k) => (k.name.split(":").pop() ?? "") === "mr");
      const lines = rows.map((row) =>
        children(row.inner)
          .filter((c) => (c.name.split(":").pop() ?? "") === "e")
          .map((c) => renderList(c.inner))
          .join(", "),
      );
      return lines.length ? `[${lines.join("; ")}]` : renderList(el.inner);
    }
    case "eqArr": {
      const lines = kids
        .filter((k) => (k.name.split(":").pop() ?? "") === "e")
        .map((k) => renderList(k.inner));
      return lines.length ? lines.join("\n") : renderList(el.inner);
    }
    default:
      // Node lạ (m:funcName, m:arg, m:sep…) — vẫn render con để không mất chữ.
      return renderList(el.inner);
  }
}

/** Render một chuỗi OMML (oMath/oMathPara hoặc fragment) thành chữ dễ đọc. */
export function renderOmml(xml: string): string {
  return renderList(xml).replace(/\s{2,}/g, " ").trim();
}

/**
 * Thay MỌI khối <m:oMathPara>/<m:oMath> trong XML đoạn văn bằng <w:r><w:t>
 * chứa chữ đã render — để parseRuns (chỉ đọc w:t) tự động thấy công thức
 * ở đúng vị trí (giữa chữ thường, trong option, trong bảng…).
 * Trả về số công thức đã thay.
 */
export function injectOmmlText(xml: string): { xml: string; equations: number } {
  let equations = 0;
  const out = xml.replace(
    /<m:oMathPara(?:\s[^>]*)?>([\s\S]*?)<\/m:oMathPara>|<m:oMath(?:\s[^>]*)?>([\s\S]*?)<\/m:oMath>/g,
    (_all, para: string | undefined, inline: string | undefined) => {
      const rendered = renderOmml(para ?? inline ?? "");
      equations++;
      if (!rendered) return "";
      return `<w:r><w:t xml:space="preserve">${escapeXml(rendered)}</w:t></w:r>`;
    },
  );
  return { xml: out, equations };
}

/**
 * Đếm công thức Equation Editor 3.0 / MathType (OLE cũ) trong document.xml.
 * Các object này là nhị phân đóng — không đọc được server-side (xem V2 ROADMAP).
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
