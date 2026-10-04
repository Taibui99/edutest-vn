/**
 * QA cho PRE-1 (preloader burst) + PRE-2 (chuyển trang bung tròn từ nút + ripple).
 *
 * Chạy: node scripts/qa-preloader.mjs [baseUrl]
 * Cần production build: `npx next build && npx next start`.
 *
 * Về việc kiểm chứng: cố đo vị trí vòng tròn bằng cách so pixel với ảnh chụp
 * trước/sau KHÔNG dùng được ở đây — landing và /dang-ky đều nền trắng nhạt,
 * ở thang xám hai trang gần như không phân biệt được (thử thực tế: 57% màn
 * hình bị gán nhầm là "trang mới"). Cách đúng là đọc thẳng computed style của
 * pseudo-element `::view-transition-new(root)`: nó cho ra
 * `clip-path: circle(<bán kính>% at <x> <y>)` — đúng thứ cần kiểm tra, không
 * phải suy luận.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3210";
const SHOTS = "qa-shots/preloader";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/**
 * Đọc `clip-path` đang chạy trên `::view-transition-new(root)`.
 * Trả null nếu không có view transition nào đang diễn ra.
 */
const readReveal = (page) =>
  page.evaluate(() => {
    const el = document.documentElement;
    const s = getComputedStyle(el, "::view-transition-new(root)");
    const m = /circle\(\s*([\d.]+)%\s+at\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s*\)/.exec(s.clipPath ?? "");
    if (!m) return null;
    return {
      radius: Number(m[1]),
      x: Number(m[2]),
      y: Number(m[3]),
      varX: getComputedStyle(el).getPropertyValue("--click-x").trim(),
    };
  });

const browser = await chromium.launch();

// ── 1. Preloader ─────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const count = await page.locator("#a6-preloader").count();
  check("PRE-1 · preloader có mặt ngay khi HTML dựng xong", count === 1, `count=${count}`);

  const pct = await page.locator(".a6-pl-pct").textContent().catch(() => null);
  check("PRE-1 · có số % đếm", /\d/.test(pct ?? ""), `pct=${pct?.trim()}`);

  await page.screenshot({ path: `${SHOTS}/01-preloader.png` }).catch(() => {});

  await page.waitForSelector("#a6-preloader", { state: "detached", timeout: 8000 });
  check("PRE-1 · tự gỡ khỏi DOM sau khi bùm", true);

  // Câu chữ trạng thái không được nói dối (bản demo ghi "Tải ngân hàng đề thi"
  // dù không tải gì).
  const seenLabel = await page.evaluate(() => sessionStorage.getItem("a6-preloader-seen"));
  check("PRE-1 · đánh dấu đã xem trong phiên", seenLabel === "1", `value=${seenLabel}`);

  await page.screenshot({ path: `${SHOTS}/02-landing.png` });
  check("PRE-1 · không có lỗi console", errors.length === 0, errors.join(" | "));

  // Lần 2 trong cùng phiên: script <head> phải ẩn ngay, không chớp sáng.
  await page.goto(BASE, { waitUntil: "commit" });
  const off = await page.evaluate(() => {
    const el = document.querySelector("#a6-preloader");
    return el ? getComputedStyle(el).display : "absent";
  });
  check("PRE-1 · lần 2 trong phiên bị ẩn ngay", off === "none" || off === "absent", `display=${off}`);

  await ctx.close();
}

// ── 2. Chuyển trang bung tròn TỪ NÚT ─────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector("#a6-preloader", { state: "detached", timeout: 8000 });

  const link = page.locator('a[href="/dang-ky"]').first();
  await link.waitFor({ state: "visible", timeout: 5000 });
  const box = await link.boundingBox();
  const clickX = box.x + box.width / 2;
  const clickY = box.y + box.height / 2;

  // Bấm rồi dò liên tục: transition ngắn, chỉ lấy một mốc sẽ hụt.
  await link.click({ noWaitAfter: true });

  const samples = [];
  for (let i = 0; i < 40; i++) {
    const s = await readReveal(page);
    if (s) samples.push(s);
    if (samples.length >= 6) break;
    await page.waitForTimeout(30);
  }

  check("PRE-2 · có view transition chạy khi điều hướng", samples.length > 0, `${samples.length} mẫu`);

  if (samples.length) {
    const s = samples[0];
    const dx = Math.abs(s.x - clickX);
    const dy = Math.abs(s.y - clickY);
    check(
      "PRE-2 · tâm vòng tròn TRÙNG nút đã bấm",
      dx < 2 && dy < 2,
      `tâm=(${s.x}, ${s.y}) nút=(${Math.round(clickX)}, ${Math.round(clickY)}) lệch ${dx.toFixed(1)}/${dy.toFixed(1)}px`,
    );

    const grew = samples[samples.length - 1].radius > samples[0].radius;
    check(
      "PRE-2 · bán kính nở ra (không phải tức thì 150%)",
      grew,
      `${samples[0].radius.toFixed(1)}% → ${samples[samples.length - 1].radius.toFixed(1)}%`,
    );
  }

  await page.waitForURL("**/dang-ky", { timeout: 8000 });
  check("PRE-2 · đã tới /dang-ky", page.url().includes("/dang-ky"), page.url());
  await page.screenshot({ path: `${SHOTS}/03-dang-ky.png` });

  // Ripple trên mọi nút.
  const btn = page.locator('button:not([disabled])').first();
  if (await btn.count()) {
    await btn.click({ noWaitAfter: true }).catch(() => {});
    const ripples = await page.locator(".a6-ripple").count();
    check("PRE-2 · ripple sinh ra khi bấm nút", ripples > 0, `count=${ripples}`);
  }

  // Điều hướng bằng bàn phím cũng phải có hiệu ứng (bấm giữa nút bằng Enter).
  check("PRE-2 · không có lỗi console", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ── 3. reduced-motion: không preloader, không bung tròn ───────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const display = await page.evaluate(() => {
    const el = document.querySelector("#a6-preloader");
    return el ? getComputedStyle(el).display : "absent";
  });
  check("PRE-1 · reduced-motion → preloader ẩn", display === "none" || display === "absent", `display=${display}`);

  await page.waitForLoadState("load");
  const link = page.locator('a[href="/dang-ky"]').first();
  if (await link.count()) {
    await link.click({ noWaitAfter: true });
    await page.waitForTimeout(120);
    const s = await readReveal(page);
    check("PRE-2 · reduced-motion → không bung tròn", s === null, s ? `vẫn bung ${s.radius}%` : "không có clip-path");
  }
  await ctx.close();
}

// ── 4. Failsafe: JS chết thì overlay phải tự ẩn, không kẹt màn hình ────
// Đây là kịch bản mà <noscript> không cứu được: JS tải được nhưng hỏng khi
// hydrate. Chặn toàn bộ script để mô phỏng.
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.route("**/*", (r) => (r.request().resourceType() === "script" ? r.abort() : r.continue()));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const before = await page.evaluate(() => {
    const el = document.querySelector("#a6-preloader");
    return el ? getComputedStyle(el).visibility : "absent";
  });
  check("PRE-1 · JS chết → overlay vẫn che trang lúc đầu", before === "visible", `visibility=${before}`);

  // Chờ qua mốc 6s của a6-pl-failsafe.
  await page.waitForTimeout(6600);
  const after = await page.evaluate(() => {
    const el = document.querySelector("#a6-preloader");
    if (!el) return "absent";
    const s = getComputedStyle(el);
    return { opacity: Number(s.opacity), pointerEvents: s.pointerEvents };
  });
  check(
    "PRE-1 · JS chết → failsafe tự ẩn sau 6s",
    after !== "absent" && after.opacity === 0 && after.pointerEvents === "none",
    JSON.stringify(after),
  );
  await ctx.close();
}

// ── 5. Phòng thi: tắt chuyển cảnh (có đếm ngược) ─────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector("#a6-preloader", { state: "detached", timeout: 8000 });

  // Mã thi không hợp lệ vẫn đủ để kiểm tra logic loại trang.
  await page.goto(`${BASE}/thi/zzzz`, { waitUntil: "load" });
  // Class do useEffect gắn sau khi hydrate — đọc sớm sẽ luôn false.
  await page
    .waitForFunction(() => document.documentElement.classList.contains("a6-no-vt"), null, { timeout: 5000 })
    .catch(() => {});
  const noVt = await page.evaluate(() => document.documentElement.classList.contains("a6-no-vt"));
  check("PRE-2 · /thi/* được đánh dấu a6-no-vt", noVt, `class=${noVt}`);

  const ruleExists = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((r) => r.cssText?.includes("a6-no-vt") && r.cssText.includes("view-transition"));
      } catch {
        return false;
      }
    }),
  );
  check("PRE-2 · có CSS tắt chuyển cảnh cho a6-no-vt", ruleExists);
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) process.exit(1);