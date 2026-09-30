import { chromium } from "@playwright/test";

const BASE = "https://edutest-vn.vercel.app";
const PAGES = [
  ["/", "home"],
  ["/vao-thi", "vaothi"],
  ["/dang-nhap", "dangnhap"],
  ["/thi/YN5GQZ", "join"],
  ["/bang-dieu-khien", "dash"],
  ["/bang-dieu-khien/de-thi", "dethi"],
  ["/bang-dieu-khien/tao-de-thi", "taodethi"],
  ["/bang-dieu-khien/ai", "ai"],
];

const audit = () => {
  const vw = window.innerWidth;
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const o = c.startsWith("rgba") && Number(m[3]) < 0.6 ? Number(m[3]) : 1;
    return { rgb: [Number(m[0]), Number(m[1]), Number(m[2])], a: o };
  };
  const over = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a));
  const ratio = (f, b) => {
    const l1 = lum(f);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const bgOf = (el) => {
    let stack = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) stack.push(c);
      n = n.parentElement;
    }
    let base = [246, 245, 251];
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i].rgb, base, stack[i].a);
    return base;
  };

  const lowContrast = [];
  const truncated = [];
  const longLine = [];
  const seen = new Set();

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let t;
  while ((t = walker.nextNode())) {
    const txt = (t.textContent || "").trim();
    if (!txt || txt.length < 3) continue;
    const el = t.parentElement;
    if (!el.getClientRects().length) continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.opacity === "0") continue;
    const fg = parse(st.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const f = fg.a < 1 ? over(fg.rgb, bg, fg.a) : fg.rgb;
    const cr = ratio(f, bg);
    const fs = parseFloat(st.fontSize);
    const large = fs >= 24 || (fs >= 18.66 && Number(st.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (cr < need) {
      const key = el.tagName + cr.toFixed(1);
      if (!seen.has(key)) {
        seen.add(key);
        lowContrast.push(`${cr.toFixed(2)}:1 (cần ${need}) fs=${fs} "${txt.slice(0, 24)}" ${st.color} -> bg rgb(${bg.map(Math.round).join(",")})`);
      }
    }
    const r = el.getBoundingClientRect();
    if (r.width > 0 && txt.length > 40) {
      const perLine = txt.length / (r.width / (fs * 0.5));
      if (perLine > 95) longLine.push(`${Math.round(perLine)} ký tự/dòng fs=${fs} "${txt.slice(0, 20)}"`);
    }
  }

  document.querySelectorAll("body *").forEach((el) => {
    if (!el.getClientRects().length) return;
    const st = getComputedStyle(el);
    if (st.overflow !== "hidden" && st.overflowX !== "hidden" && st.textOverflow !== "ellipsis") return;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (!hasText) return;
    if (el.scrollWidth > el.clientWidth + 2 && st.whiteSpace !== "nowrap" && st.textOverflow !== "ellipsis") {
      truncated.push(`${el.tagName}.${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 26)}"`);
    } else if (st.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 2 && el.textContent.trim().length > 24) {
      truncated.push(`ELLIPSIS "${el.textContent.trim().slice(0, 34)}"`);
    }
  });

  const pad = [];
  const main = document.querySelector("main") || document.querySelector("div");
  const mp = main ? parseFloat(getComputedStyle(main).paddingLeft) : null;
  if (mp !== null && mp < 12) pad.push(`main padding-left=${mp}px`);

  const grids = [...new Set([...document.querySelectorAll("*")]
    .filter((el) => {
      if (!el.getClientRects().length) return false;
      const d = getComputedStyle(el).display;
      return d === "grid" || d === "inline-grid";
    })
    .map((el) => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length;
      const w = Math.round(el.getBoundingClientRect().width);
      return cols >= 3 && w < 340 ? `${cols} cột / ${w}px` : null;
    })
    .filter(Boolean))];

  const h1 = document.querySelector("h1");
  const empty = [...document.querySelectorAll("section, div")]
    .filter((el) => {
      if (!el.getClientRects().length) return false;
      const r = el.getBoundingClientRect();
      return r.height > 260 && r.width > 300 && !el.textContent.trim() && !el.querySelector("img,svg,canvas,video");
    }).length;

  return {
    vw,
    lowContrast: [...new Set(lowContrast)].slice(0, 6),
    truncated: [...new Set(truncated)].slice(0, 6),
    longLine: [...new Set(longLine)].slice(0, 4),
    narrowGrids: grids.slice(0, 4),
    pad,
    h1: h1 ? getComputedStyle(h1).fontSize : null,
    emptyBlocks: empty,
  };
};

const width = Number(process.argv[2] || 390);
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
await page.goto(BASE + "/dang-nhap", { waitUntil: "domcontentloaded" });
await page.locator("#email").fill("tester-gv-20260816@edutest.vn");
await page.locator("#password").fill("Test@12345");
await page.getByRole("button", { name: /đăng nhập/i }).click();
await page.waitForURL(/bang-dieu-khien/, { timeout: 25000 });

for (const [path, name] of PAGES) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 35000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const r = await page.evaluate(audit);
  console.log(`\n=== ${name} (${path}) ===`);
  for (const k of ["lowContrast", "truncated", "longLine", "narrowGrids", "pad"]) {
    if (r[k].length) console.log(` ${k}: ${r[k].join(" | ")}`);
  }
  console.log(` h1=${r.h1} emptyBlocks=${r.emptyBlocks}`);
}
await browser.close();