import { chromium } from "@playwright/test";

const BASE = "https://edutest-vn.vercel.app";
const GUEST = ["/", "/vao-thi", "/dang-nhap", "/dang-ky", "/thi/YN5GQZ"];
const TEACHER = ["/bang-dieu-khien", "/bang-dieu-khien/de-thi", "/bang-dieu-khien/tao-de-thi", "/bang-dieu-khien/lop-hoc", "/bang-dieu-khien/thong-ke", "/bang-dieu-khien/ngan-hang", "/bang-dieu-khien/ho-so", "/bang-dieu-khien/hoc-sinh", "/bang-dieu-khien/tien-do", "/bang-dieu-khien/ai"];

const audit = async () =>
  // eslint-disable-next-line no-eval
  await (0, eval)(`(() => {
    const vw = window.innerWidth;
    const se = document.scrollingElement;
    const small = [], tinyFont = [], offscreen = [], zoomRisk = [];
    const nodes = document.querySelectorAll("a,button,input,select,textarea,[role=button],[role=tab]");
    nodes.forEach((n) => {
      if (!n.getClientRects().length) return;
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const inline = getComputedStyle(n).display === "inline" && n.tagName === "A";
      if (!inline && r.height < 40) small.push((n.tagName + ":" + (n.innerText || n.getAttribute("aria-label") || n.placeholder || "").trim().slice(0, 24)) + " h=" + Math.round(r.height) + " w=" + Math.round(r.width));
      if (["INPUT","TEXTAREA","SELECT"].includes(n.tagName) && !["checkbox","radio","range","color"].includes(n.type)) {
        const fs = parseFloat(getComputedStyle(n).fontSize);
        if (fs < 16) zoomRisk.push(n.tagName + " fontSize=" + fs);
      }
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = walker.nextNode())) {
      const txt = (t.textContent || "").trim();
      if (!txt || t.parentElement.closest("script,style,noscript")) continue;
      if (!t.parentElement.getClientRects().length) continue;
      const fs = parseFloat(getComputedStyle(t.parentElement).fontSize);
      if (fs < 13) tinyFont.push(txt.slice(0, 22) + "=" + fs + "px");
    }
    document.querySelectorAll("body *").forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width > 12 && r.right > vw + 2) offscreen.push(n.tagName + "." + String(n.className || "").slice(0, 44) + " right=" + Math.round(r.right));
    });
    const fixed = [...document.querySelectorAll("*")].filter((n) => {
      const p = getComputedStyle(n).position;
      return (p === "fixed" || p === "sticky") && n.getBoundingClientRect().height > 0;
    }).map((n) => n.tagName + "." + String(n.className || "").slice(0, 40) + " pos=" + getComputedStyle(n).position + " h=" + Math.round(n.getBoundingClientRect().height));
    const main = document.querySelector("main");
    const bodyPb = parseFloat(getComputedStyle(document.body).paddingBottom || 0);
    const mainPb = main ? parseFloat(getComputedStyle(main).paddingBottom || 0) : 0;
    const faces = document.fonts ? [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "") + "/" + f.weight) : [];
    const last = document.body.lastElementChild;
    return {
      overflow: se ? se.scrollWidth - vw : 0,
      h: se ? se.scrollHeight : 0,
      fontLoaded: faces.some((f) => /Be Vietnam/i.test(f)),
      h1Font: (document.querySelector("h1") && getComputedStyle(document.querySelector("h1")).fontFamily) || null,
      bodyFont: getComputedStyle(document.body).fontFamily,
      tapTargetsSmall: [...new Set(small)].slice(0, 8),
      inputZoomRisk: [...new Set(zoomRisk)].slice(0, 5),
      tinyText: [...new Set(tinyFont)].slice(0, 5),
      offscreen: [...new Set(offscreen)].slice(0, 5),
      stickyOrFixed: [...new Set(fixed)].slice(0, 5),
      paddingBottom: { body: bodyPb, main: mainPb },
      textLen: (document.body.innerText || "").length,
    };
  })()`);

const width = Number(process.argv[2] || 390);
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width, height: 844 },
  isMobile: width < 500,
  hasTouch: width < 500,
  userAgent: width < 500 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" : undefined,
});
const page = await ctx.newPage();
const rows = [];
let cspErrors = 0;

page.on("console", (m) => {
  if (m.type() === "error" && /Content Security Policy|violates/i.test(m.text())) cspErrors++;
});

const visit = async (path) => {
  try {
    const before = cspErrors;
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 35000 }).catch(() => page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 }));
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const a = await page.evaluate(audit);
    rows.push({ path, ...a, csp: cspErrors - before });
  } catch (e) {
    rows.push({ path, fatal: String(e.message).slice(0, 100) });
  }
};

for (const p of GUEST) await visit(p);
await page.goto(BASE + "/dang-nhap", { waitUntil: "domcontentloaded" });
await page.locator("#email").fill("tester-gv-20260816@edutest.vn");
await page.locator("#password").fill("Test@12345");
await page.getByRole("button", { name: /đăng nhập/i }).click();
await page.waitForURL(/bang-dieu-khien/, { timeout: 25000 }).catch(() => rows.push({ path: "LOGIN", fatal: "login failed" }));
for (const p of TEACHER) await visit(p);
await browser.close();

const problems = rows.filter((r) => r.fatal || r.overflow > 1 || !r.fontLoaded || r.csp > 0 || (r.tapTargetsSmall || []).length || (r.inputZoomRisk || []).length || (r.tinyText || []).length || (r.offscreen || []).length);
console.log("=== VAN DE ===");
for (const r of problems) {
  console.log("\n[" + r.path + "]" + (r.fatal ? " FATAL " + r.fatal : ""));
  if (r.overflow > 1) console.log("  overflowX: +" + r.overflow + "px");
  if (r.fontLoaded === false) console.log("  fontLoaded: FALSE (van chay font he thong)");
  if (r.csp > 0) console.log("  loi CSP: " + r.csp);
  if (r.tinyText?.length) console.log("  tinyText(<13px): " + r.tinyText.join(" | "));
  if (r.tapTargetsSmall?.length) console.log("  tap<40px: " + r.tapTargetsSmall.join(" | "));
  if (r.inputZoomRisk?.length) console.log("  iOS-zoom(input font<16): " + r.inputZoomRisk.join(" | "));
  if (r.offscreen?.length) console.log("  offscreen: " + r.offscreen.join(" | "));
}
console.log("\n=== TAT CA TRANG (textLen, chiHe) ===");
for (const r of rows) console.log(`${r.path} | len=${r.textLen} | pb=${r.paddingBottom?.body}/${r.paddingBottom?.main} | sticky=${(r.stickyOrFixed || []).length}`);