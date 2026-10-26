import { readCfbStreams } from "./cfb.ts";

/**
 * PARSE-6 — Giải mã MathType MTEF v5 (Equation Editor / MathType 7) → LaTeX.
 *
 * Bối cảnh: đề Word có 2 loại công thức — OMML (`<m:oMath>`, đã xử lý ở
 * `omml-text.ts`) và MathType 7 (OLE `Equation.DSMT4`, nhị phân MTEF v5 nằm
 * trong stream "Equation Native" của file `word/embeddings/oleObjectN.bin`).
 * OMML chiếm ~93%; MathType là phần hiếm còn lại (câu hỏi lẻ, thường trả lời
 * ngắn). Module này dịch MTEF → LaTeX để hiển thị đúng như đề, không cần AI.
 *
 * Cấu trúc stream "Equation Native":
 *   [28-byte OLE header] + [MTEF v5]
 * MTEF v5 = header 5 byte (version, platform, product, prodVersion, subVersion)
 *   + appkey (chuỗi null-terminated, vd "DSMT7") + options byte
 *   + danh sách record (mỗi record: type byte + options byte + dữ liệu).
 *
 * Tham chiếu: "MathType MTEF v.5" (Design Science) — spec công khai.
 * Module thuần JS (không phụ thuộc), chạy được trên serverless.
 */

/** Record type của MTEF. */
const T = {
  END: 0,
  LINE: 1,
  CHAR: 2,
  TMPL: 3,
  PILE: 4,
  MATRIX: 5,
  EMBELL: 6,
  RULER: 7,
  FONT_STYLE_DEF: 8,
  SIZE: 9,
  FULL: 10,
  SUB: 11,
  SUB2: 12,
  SYM: 13,
  SUBSYM: 14,
  COLOR: 15,
  COLOR_DEF: 16,
  FONT_DEF: 17,
  EQN_PREFS: 18,
  ENCODING_DEF: 19,
} as const;

const OPT_NUDGE = 0x08;
const OPT_CHAR_EMBELL = 0x01;
const OPT_CHAR_ENC_CHAR_8 = 0x04;
const OPT_CHAR_ENC_CHAR_16 = 0x10;
const OPT_CHAR_ENC_NO_MTCODE = 0x20;
const OPT_LINE_NULL = 0x01;
const OPT_LINE_LSPACE = 0x04;
const OPT_LP_RULER = 0x02;

/** Mã selector template của MathType → tên (theo spec MTEF v5). */
const TEMPLATE = {
  ANGLE: 0,
  PAREN: 1,
  BRACE: 2,
  BRACK: 3,
  BAR: 4,
  DBAR: 5,
  FLOOR: 6,
  CEILING: 7,
  OBRACK: 8,
  INTERVAL: 9,
  ROOT: 10,
  FRACT: 11,
  UBAR: 12,
  OBAR: 13,
  ARROW: 14,
  INTEG: 15,
  SUM: 16,
  PROD: 17,
  COPROD: 18,
  UNION: 19,
  INTER: 20,
  INTOP: 21,
  SUMOP: 22,
  LIM: 23,
  HBRACE: 24,
  HBRACK: 25,
  LDIV: 26,
  SUB: 27,
  SUP: 28,
  SUBSUP: 29,
  DIRAC: 30,
  VEC: 31,
  TILDE: 32,
  HAT: 33,
  ARC: 34,
  JSTATUS: 35,
  STRIKE: 36,
  BOX: 37,
} as const;

class Reader {
  buf: Buffer;
  pos: number;
  constructor(buf: Buffer, pos: number) {
    this.buf = buf;
    this.pos = pos;
  }
  /** "Unsigned integer": <255 = 1 byte; >=255 = 3 byte (0xFF, lo, hi). */
  u(): number {
    const b = this.buf[this.pos++];
    if (b < 0xff) return b;
    const lo = this.buf[this.pos++];
    const hi = this.buf[this.pos++];
    return lo + (hi << 8);
  }
  /** "Signed integer": biased. <127 = 1 byte(-128); else 3 byte. */
  s(): number {
    const b = this.buf[this.pos++];
    if (b < 255) return b - 128;
    const lo = this.buf[this.pos++];
    const hi = this.buf[this.pos++];
    return lo + (hi << 8) - 32768;
  }
  byte(): number {
    return this.buf[this.pos++];
  }
  /** Chuỗi null-terminated (Latin-1). */
  str(): string {
    let s = "";
    while (this.pos < this.buf.length && this.buf[this.pos] !== 0) {
      s += String.fromCharCode(this.buf[this.pos++]);
    }
    this.pos++;
    return s;
  }
  peek(): number {
    return this.buf[this.pos];
  }
  eof(): boolean {
    return this.pos >= this.buf.length;
  }
}

type Ctx = {
  /** Bảng typeface → tên font (theo index FONT_STYLE_DEF / FONT_DEF). */
  faceNames: string[];
};

type Node =
  | { kind: "line"; kids: Node[] }
  | { kind: "pile"; lines: Node[][] }
  | { kind: "char"; ch: string; face: string }
  | { kind: "tmpl"; sel: number; slots: Node[][]; sub: Node[][]; variation: number }
  | { kind: "ruler" }
  | { kind: "size"; val: number };

const SAT = 1000;

/** Đọc nội dung một object list tới END. */
function readList(r: Reader, ctx: Ctx): Node[] {
  const out: Node[] = [];
  let guard = 0;
  while (r.pos < r.buf.length && guard++ < SAT) {
    const t = r.buf[r.pos];
    if (t === T.END) {
      r.pos++;
      return out;
    }
    const node = readRecord(r, ctx);
    if (node) out.push(node);
  }
  return out;
}

function readRecord(r: Reader, ctx: Ctx): Node | null {
  const type = r.byte();
  if (type >= 100) {
    // Future record: 4-byte length rồi skip.
    const len = r.buf.readUInt32LE(r.pos);
    r.pos += 4 + len;
    return null;
  }
  switch (type) {
    case T.LINE: {
      const opts = r.byte();
      if (opts & OPT_NUDGE) {
        r.s();
        r.s();
      }
      if (opts & OPT_LINE_LSPACE) r.pos += 2;
      if (opts & OPT_LP_RULER) skipRuler(r);
      if (opts & OPT_LINE_NULL) return null;
      const kids = readList(r, ctx);
      return { kind: "line", kids };
    }
    case T.PILE: {
      const opts = r.byte();
      if (opts & OPT_NUDGE) {
        r.s();
        r.s();
      }
      r.byte(); // halign
      r.byte(); // valign
      if (opts & OPT_LP_RULER) skipRuler(r);
      const lines = readLines(r, ctx);
      return { kind: "pile", lines };
    }
    case T.MATRIX: {
      r.byte(); // options
      readList(r, ctx); // bỏ qua ma trận — hiếm trong đề phổ thông
      return null;
    }
    case T.CHAR: {
      const opts = r.byte();
      if (opts & OPT_NUDGE) {
        r.s();
        r.s();
      }
      const typeface = r.s();
      let ch = "";
      if (!(opts & OPT_CHAR_ENC_NO_MTCODE)) {
        // MTCode viết dạng 16-bit integer (low byte trước).
        const lo = r.byte();
        const hi = r.byte();
        ch = String.fromCharCode(lo + (hi << 8));
      }
      if (opts & OPT_CHAR_ENC_CHAR_8) r.byte();
      if (opts & OPT_CHAR_ENC_CHAR_16) r.pos += 2;
      if (opts & OPT_CHAR_EMBELL) readList(r, ctx);
      const face = typeface > 0 ? faceStyle(typeface) : ctx.faceNames[-typeface - 1] ?? "";
      return { kind: "char", ch: mapMtChar(ch), face };
    }
    case T.TMPL: {
      const opts = r.byte();
      if (opts & OPT_NUDGE) {
        r.s();
        r.s();
      }
      const sel = r.byte();
      // Variation: 1 byte, hoặc 2 byte nếu byte đầu có bit cao (0x80).
      let variation = r.byte();
      if (variation & 0x80) variation = (variation & 0x7f) | (r.byte() << 8);
      // Template-specific options: LUÔN có 1 byte (chỉ mang nghĩa với fence và
      // tích phân, nhưng vẫn phải đọc để không lệch stream).
      r.byte();
      const slots = readLines(r, ctx);
      return { kind: "tmpl", sel, slots, sub: [], variation };
    }
    case T.FONT_STYLE_DEF: {
      r.u(); // font def index
      r.byte(); // char style: bit0 bold, bit1 italic
      return null;
    }
    case T.FONT_DEF: {
      r.u(); // enc def index
      ctx.faceNames.push(r.str());
      return null;
    }
    case T.ENCODING_DEF: {
      r.str();
      return null;
    }
    case T.SIZE: {
      // SIZE (9): explicit byte, hoặc lsize + dsize.
      const b = r.byte();
      if (b === 101) {
        r.pos += 2; // -point size (16-bit)
      } else if (b === 100) {
        r.byte(); // lsize
        r.pos += 2; // dsize (16-bit)
      } else {
        r.byte(); // dsize + 128
      }
      return null;
    }
    case T.FULL:
    case T.SUB:
    case T.SUB2:
    case T.SYM:
    case T.SUBSYM:
      // Typesize records (10-14): chỉ có tag, không dữ liệu.
      return null;
    case T.COLOR: {
      // COLOR (15): chỉ có color_def_index, KHÔNG có options byte.
      r.u();
      return null;
    }
    case T.COLOR_DEF: {
      // COLOR_DEF (16): options, rồi 3 (RGB) hoặc 4 (CMYK) giá trị 16-bit,
      // rồi tên null-terminated nếu bật cờ NAME. Không có index.
      const opts = r.byte();
      const values = opts & 0x01 ? 4 : 3;
      r.pos += values * 2;
      if (opts & 0x04) r.str();
      return null;
    }
    case T.EQN_PREFS: {
      // Nibble-packed, độ phức tạp cao — bỏ qua, không ảnh hưởng ký tự.
      skipEqnPrefs(r);
      return null;
    }
    case T.EMBELL: {
      r.byte();
      return null;
    }
    case T.RULER: {
      skipRuler(r);
      return null;
    }
    default: {
      // Record lạ: cố dừng an toàn.
      r.pos++;
      return null;
    }
  }
}

function readLines(r: Reader, ctx: Ctx): Node[][] {
  const lines: Node[][] = [];
  let guard = 0;
  while (r.pos < r.buf.length && guard++ < SAT) {
    const t = r.buf[r.pos];
    if (t === T.END) {
      r.pos++;
      return lines;
    }
    if (t === T.LINE) {
      const node = readRecord(r, ctx);
      if (node && node.kind === "line") lines.push(node.kids);
    } else {
      const node = readRecord(r, ctx);
      if (node) lines.push([node]);
    }
  }
  return lines;
}

function skipRuler(r: Reader) {
  const n = r.byte();
  for (let i = 0; i < n; i++) {
    r.byte(); // tab-stop type
    r.pos += 2; // 16-bit offset
  }
}

function skipEqnPrefs(r: Reader) {
  // EQN_PREFS: options + 2 dimension arrays + styles array
  if (r.pos >= r.buf.length) return;
  r.byte(); // options
  skipDimArray(r);
  skipDimArray(r);
  if (r.pos >= r.buf.length) return;
  const cnt = r.byte();
  for (let i = 0; i < cnt && r.pos < r.buf.length; i++) {
    const idx = r.u();
    if (idx !== 0 && r.pos < r.buf.length) r.byte(); // char style
  }
}

/** Dimension array: count byte + nibble stream, pad 0 cho đủ byte cuối. */
function skipDimArray(r: Reader) {
  if (r.pos >= r.buf.length) return;
  const count = r.byte();
  let done = 0;
  let guard = 0;
  while (done < count && r.pos < r.buf.length && guard++ < 4096) {
    const byte = r.byte();
    // Upper nibble precedes lower nibble; phần dư trong byte cuối là padding 0.
    for (const nib of [byte >> 4, byte & 0x0f]) {
      if (nib === 0x0f) done++;
      if (done >= count) break;
    }
  }
}

/** Typeface 1..24 → quy ước LaTeX (Greek, italic…). */
function faceStyle(t: number): string {
  switch (t) {
    case 4:
      return "lgreek";
    case 5:
      return "ugreek";
    case 6:
      return "symbol";
    default:
      return "";
  }
}

/** Vài ký tự MathType/symbol ngoài ASCII → Unicode/LaTeX. */
function mapMtChar(ch: string): string {
  const code = ch.charCodeAt(0);
  // Vùng Private Use (MT Extra / ký tự nội bộ MathType) không có nghĩa khi
  // hiển thị → bỏ, tránh lọt ký tự rác vào đề.
  if (code >= 0xe000 && code <= 0xf8ff) return "";
  const map: Record<number, string> = {
    0x41: "A",
    0x2a: "∗",
    0x2d: "−",
    0xb4: "×",
    0xd7: "⋅",
    0xf2: "∫",
  };
  return map[code] ?? ch;
}

const GREEK: Record<number, string> = {
  0x61: "\\alpha",
  0x62: "\\beta",
  0x67: "\\gamma",
  0x64: "\\delta",
  0x72: "\\rho",
  0x6c: "\\lambda",
  0x6d: "\\mu",
  0x70: "\\pi",
  0x73: "\\sigma",
  0x74: "\\tau",
  0x77: "\\omega",
};

function renderNodes(nodes: Node[]): string {
  return nodes.map(renderNode).join("");
}

function renderNode(n: Node): string {
  switch (n.kind) {
    case "line":
      return renderNodes(n.kids);
    case "pile":
      return n.lines.map(renderNodes).join(" ");
    case "char":
      return renderChar(n);
    case "tmpl":
      return renderTmpl(n);
    case "size":
    case "ruler":
      return "";
  }
}

function renderChar(n: { ch: string; face: string }): string {
  if (n.face === "lgreek" || n.face === "ugreek") {
    const g = GREEK[n.ch.charCodeAt(0)];
    if (g) return g;
  }
  return n.ch;
}

function renderTmpl(n: { sel: number; slots: Node[][]; sub: Node[][]; variation: number }): string {
  const { sel, slots, sub, variation } = n;
  const s0 = slots[0] ? renderNodes(slots[0]) : "";
  const s1 = slots[1] ? renderNodes(slots[1]) : "";
  // Limit/big-op templates: subobjects theo thứ tự [base, lower, upper].
  const a0 = renderNodes(slots[0] ?? []);
  const a1 = renderNodes(slots[1] ?? []);
  const a2 = renderNodes(slots[2] ?? []);
  const lower = variation & 0x0001 ? a1 : "";
  const upper = variation & 0x0002 ? a2 : "";
  const lim = (sym: string) =>
    `{${sym}` + (lower ? `_{${lower}}` : "") + (upper ? `^{${upper}}` : "") + "}";
  switch (sel) {
    case TEMPLATE.FRACT:
      if (variation & 0x0002) return `${s0}/${s1}`;
      return `\\frac{${s0}}{${s1}}`;
    case TEMPLATE.ROOT:
      if (variation & 0x0001) return `\\sqrt[${s1}]{${s0}}`;
      return `\\sqrt{${s0}}`;
    case TEMPLATE.SUB:
      return `_{${s0}}`;
    case TEMPLATE.SUP:
      return `^{${s0}}`;
    case TEMPLATE.SUBSUP:
      return `_{${s0}}^{${s1}}`;
    case TEMPLATE.PAREN:
      return `\\left(${s0}\\right)`;
    case TEMPLATE.BRACK:
      return `\\left[${s0}\\right]`;
    case TEMPLATE.BRACE:
      return `\\left\\{${s0}\\right\\}`;
    case TEMPLATE.BAR:
      return `\\left|${s0}\\right|`;
    case TEMPLATE.DBAR:
      return `\\left\\|${s0}\\right\\|`;
    case TEMPLATE.FLOOR:
      return `\\left\\lfloor ${s0}\\right\\rfloor`;
    case TEMPLATE.CEILING:
      return `\\left\\lceil ${s0}\\right\\rceil`;
    case TEMPLATE.ANGLE:
      return `\\left\\langle ${s0}\\right\\rangle`;
    case TEMPLATE.OBAR:
      return `\\overline{${s0}}`;
    case TEMPLATE.UBAR:
      return `\\underline{${s0}}`;
    case TEMPLATE.HBRACE:
      return `\\overbrace{${a0}}` + (a1 ? `^{${a1}}` : "");
    case TEMPLATE.HBRACK:
      return `\\underbrace{${a0}}` + (a1 ? `_{${a1}}` : "");
    case TEMPLATE.INTEG:
      return lim("\\int") + a0;
    case TEMPLATE.SUM:
      return lim("\\sum") + a0;
    case TEMPLATE.PROD:
      return lim("\\prod") + a0;
    case TEMPLATE.COPROD:
      return lim("\\coprod") + a0;
    case TEMPLATE.UNION:
      return lim("\\bigcup") + a0;
    case TEMPLATE.INTER:
      return lim("\\bigcap") + a0;
    case TEMPLATE.INTOP:
      return a0 + a1;
    case TEMPLATE.SUMOP:
      return a0 + a1;
    case TEMPLATE.LIM:
      return `\\lim` + (renderNodes(sub[0] ?? []) ? `_{${renderNodes(sub[0] ?? [])}}` : "") + a0;
    case TEMPLATE.ARROW:
      return (a1 ? `\\underset{${a1}}{` : "") + "\\rightarrow" + (a1 ? "}" : "");
    default:
      return a0 + a1 + a2;
  }
}

/** Bỏ 28-byte OLE header (nếu có) rồi parse header MTEF. Trả về vị trí body. */
function findMtefStart(buf: Buffer): number {
  // MTEF v5 bắt đầu bằng [5, platform, product, prodVer, sub] — prodVer >= 3.
  for (let off = 0; off + 8 < buf.length; off++) {
    if (buf[off] === 5 && buf[off + 1] <= 1 && buf[off + 2] <= 1 && buf[off + 3] >= 3) {
      return off;
    }
  }
  return 28; // mặc định: MathType luôn thêm 28-byte header
}

/**
 * Giải mã file `word/embeddings/oleObjectN.bin` (CFB chứa stream "Equation
 * Native": 28-byte EQNOLEFILEHDR + MTEF v5) → LaTeX.
 * Trả về "" nếu không decode được.
 */
export function mtefToLatex(oleBuf: Buffer): string {
  try {
    const stream = readCfbStreams(oleBuf).get("Equation Native") ?? oleBuf;
    const start = findMtefStart(stream);
    if (start < 0 || start >= stream.length) return "";
    const r = new Reader(stream, start);
    // Header MTEF v5: 5 byte + appkey + options.
    r.pos += 5; // version, platform, product, prodVer, sub
    if (r.pos >= r.buf.length) return "";
    r.str(); // appkey
    if (r.pos >= r.buf.length) return "";
    r.byte(); // options (inline/display)

    // Sau header là các định nghĩa (FONT_STYLE_DEF, FONT_DEF, EQN_PREFS, SIZE…)
    // rồi mới tới thân công thức. Duyệt tuần tự — không dò mẫu, vì body có thể
    // mở đầu bằng bất kỳ record nào (CHAR, TMPL, PILE…).
    const ctx: Ctx = { faceNames: [] };
    const bodyPos = r.pos;
    const nodes = readList(r, ctx);
    const tex = normalize(renderNodes(nodes));
    if (tex) return tex;

    // Fallback: một số object bọc body trong LINE → đọc theo kiểu danh sách dòng.
    const lines = readLines(new Reader(r.buf, bodyPos), ctx);
    return normalize(lines.map(renderNodes).join(" "));
  } catch {
    return "";
  }
}

function normalize(tex: string): string {
  return tex
    .replace(/\s+/g, " ")
    .replace(/\\left\(/g, "\\left(")
    .replace(/\\right\)/g, "\\right)")
    .trim();
}

/** Đếm số stream MathType trong zip buffer docx (không giải mã). */
export function countMtefObjects(docXml: string): number {
  return (docXml.match(/ProgID="Equation\.DSMT4"/g) ?? []).length;
}
