/**
 * QA cho PRE-1 (preloader burst) + PRE-2 (trượt ngang kiểu Canva + ripple).
 *
 * Chạy: node scripts/qa-preloader.mjs [baseUrl]
 * Cần production build: `npx next build && npx next start`.
 *
 * Về việc kiểm chứng: **không thể dùng ảnh chụp để kiểm trang có trượt hay
 * không.** `page.screenshot()` của Playwright KHÔNG chụp lớp render của View
 * Transitions API — thử thực tế: ép `::view-transition-old(root)` thành màu đỏ
 * đậm, giữ animation 6s rồi chụp giữa chừng → 0 pixel đỏ trong ảnh, trong khi
 * `document.getAnimations()` báo animation đang `running`. Hệ quả là mọi so sánh
 * pixel trước đây đều vô hiệu và từng kết luận nhầm "không trượt".
 *
 * Cách đúng: đọc thẳng computed transform của `::view-transition-old/new(root)`
 * (trả `matrix(1, 0, 0, 1, tx, ty)`) và đếm animation còn bám pseudo-element.
 * Đo bằng px chứ không suy luận từ ảnh chụp.
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
 * Đọc transform trên ảnh chụp trang cũ/mới của View Transitions API.
 * Trả null nếu không có transition nào đang diễn ra.
 *
 * `getComputedStyle` trả về `matrix(1, 0, 0, 1, tx, ty)` — lấy cột e (vị trí
 * thứ 5) làm dịch chuyển ngang. Đo bằng px chứ không suy luận từ ảnh chụp.
 */
const readSlide = (page) =>
  page.evaluate(() => {
    const el = document.documentElement;
    const tx = (pseudo) => {
      const s = getComputedStyle(el, pseudo);
      const m = /matrix\(([^)]+)\)/.exec(s.transform ?? "");
      if (!m) return { tx: null, anim: s.animationName };
      const p = m[1].split(",").map((v) => parseFloat(v.trim()));
      return { tx: p[4], anim: s.animationName };
    };
    return {
      nw: tx("::view-transition-new(root)"),
      ol: tx("::view-transition-old(root)"),
      slide: document.documentElement.getAttribute("data-slide"),
      vw: window.innerWidth,
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

  // Không còn cờ sessionStorage: preloader phải hiện MỌI lần tải trang.
  // Người dùng phàn nàn là "loading đứng ở 1% rồi đùng vào web luôn".
  const seenFlag = await page.evaluate(() => sessionStorage.getItem("a6-preloader-seen"));
  check("PRE-1 · không còn cờ ẩn preloader theo phiên", seenFlag === null, `value=${seenFlag}`);

  await page.screenshot({ path: `${SHOTS}/02-landing.png` });
  check("PRE-1 · không có lỗi console", errors.length === 0, errors.join(" | "));

  // Lần 2 trong cùng phiên: phải hiện LẠI. Đây là yêu cầu hiện tại.
  await page.goto(BASE, { waitUntil: "commit" });
  let second = 0;
  for (let i = 0; i < 80; i++) {
    second = await page.locator("#a6-preloader").count();
    if (second > 0) break;
    await page.waitForTimeout(25);
  }
  check("PRE-1 · lần 2 trong cùng phiên vẫn hiện lại", second === 1, `count=${second}`);

  await ctx.close();
}

// ── 2. Trượt ngang khi chuyển màn hình + ripple ───────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  // Local không chạy Postgres nên vài API (vd. `prisma.user.count()`) trả 500
  // "Can't reach database server at localhost:5432". Đó là môi trường, không phải
  // lỗi UI — chỉ bỏ qua khi đích là localhost, còn chạy production vẫn kiểm
  // nghiêm ngặt. Danh sách URL bị 500 vẫn in riêng để không che giấu gì.
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(BASE);
  const serverErrors = [];
  page.on("response", (r) => {
    if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (isLocal && /status of 500/.test(text) && serverErrors.length) return;
    errors.push(text);
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector("#a6-preloader", { state: "detached", timeout: 8000 });

  const link = page.locator('a[href="/dang-ky"]').first();
  await link.waitFor({ state: "visible", timeout: 5000 });

  // Bấm rồi dò liên tục cho tới khi đủ mẫu HỢP LỆ.
  // Mẫu hợp lệ = animationName khác "none" VÀ transform đọc ra matrix. Lúc
  // pseudo-element vừa mới sinh ra (hoặc vừa biến mất) getComputedStyle trả
  // chuỗi rỗng → tx=null; nếu bỏ sót thì Math.round(null)=0 làm hỏng mọi
  // assert (trước đây "trang mới vào TỪ PHẢI" bị báo sai là 0px → 322px).
  await link.click({ noWaitAfter: true });

  const samples = [];
  for (let i = 0; i < 240; i++) {
    const s = await readSlide(page);
    if (s.nw.anim !== "none" && s.nw.tx !== null && s.ol.tx !== null) samples.push(s);
    if (samples.length >= 12) break;
    await page.waitForTimeout(30);
  }

  check(
    "PRE-2 · có animation trượt khi điều hướng",
    samples.length > 0,
    samples.length ? `${samples.length} mẫu` : "animationName=none ở cả 160 lần đo",
  );

  if (samples.length) {
    const vw = samples[0].vw;
    const newTx = samples.map((s) => s.nw.tx);
    const oldTx = samples.map((s) => s.ol.tx);
    const first = newTx[0];
    const last = newTx[newTx.length - 1];

    check(
      "PRE-2 · trang mới vào TỪ PHẢI (translateX dương → 0)",
      first > 100 && last < first,
      `${Math.round(first)}px → ${Math.round(last)}px (viewport=${vw}px)`,
    );

    check(
      "PRE-2 · trang cũ ra BÊN TRÁI (0 → translateX âm)",
      oldTx[oldTx.length - 1] < oldTx[0] && oldTx[oldTx.length - 1] < -100,
      `${Math.round(oldTx[0])}px → ${Math.round(oldTx[oldTx.length - 1])}px`,
    );

    // Invariant quan trọng nhất: hai ảnh phải luôn liền mép. Khoảng cách giữa
    // mép phải đúng bằng bề rộng viewport ở MỌI mốc thời gian, nếu lệch nghĩa
    // là có khoảng trống hở ra giữa hai trang.
    const maxDrift = Math.max(
      ...samples.map((s) => Math.abs(s.nw.tx - s.ol.tx - s.vw)),
    );
    check(
      "PRE-2 · hai trang liền mép suốt quá trình trượt (không hở khe)",
      maxDrift < 2,
      `lệch lớn nhất ${maxDrift.toFixed(2)}px`,
    );

    check(
      "PRE-2 · hướng trượt = next khi bấm link",
      samples[samples.length - 1].slide === "next",
      `data-slide=${samples[samples.length - 1].slide}`,
    );
  }

  await page.waitForURL("**/dang-ky", { timeout: 8000 });
  check("PRE-2 · đã tới /dang-ky", page.url().includes("/dang-ky"), page.url());

  // Transition phải kết thúc — không để lại pseudo-element treo.
  // KHÔNG đọc `animationName` để phán "đã xong": khi pseudo-element biến mất,
  // `getComputedStyle(el, "::view-transition-new(root)")` vẫn trả về tên animation
  // theo CSS rule (test thực tế: giữ nguyên "a6-slide-in-next" vô hạn), nên kiểu
  // kiểm `=== "none"` không bao giờ đúng. Tín hiệu đáng tin là không còn animation
  // nào bám vào pseudo-element của view-transition nữa.
  const ended = await page
    .waitForFunction(
      () =>
        !document
          .getAnimations()
          .some((a) => (a.effect?.pseudoElement ?? "").startsWith("::view-transition")),
      null,
      { timeout: 4000 },
    )
    .then(() => true)
    .catch(() => false);
  check("PRE-2 · transition tự kết thúc (không treo)", ended);
  await page.screenshot({ path: `${SHOTS}/03-dang-ky.png` });

  // ── Quay lại: phải ghi hướng NGƯỢC ──
  // Kiểm thực tế: React CHƯA gọi `document.startViewTransition()` khi bấm back
  // của trình duyệt (đo bằng cách vá thẳng API: số lần gọi đứng yên ở 1 sau
  // `history.back()`), nên không có ảnh chụp để đọc toạ độ. Cái kiểm được là
  // hướng đã ghi đúng và CSS trượt ngược có thật sự nối với `data-slide="prev"`
  // — nếu React bật VT cho popstate thì mọi thứ tự chạy.
  const prevSamples = [];
  await page.goBack({ waitUntil: "commit" }).catch(() => {});
  for (let i = 0; i < 60; i++) {
    const s = await readSlide(page);
    if (s.nw.anim && s.nw.anim !== "none") prevSamples.push(s);
    if (prevSamples.length >= 6) break;
    await page.waitForTimeout(30);
  }
  check(
    "PRE-2 · back → data-slide=prev",
    prevSamples.length > 0 && prevSamples[0].slide === "prev",
    prevSamples.length ? `data-slide=${prevSamples[0].slide}` : "không đọc được hướng",
  );
  if (prevSamples.length) {
    check(
      "PRE-2 · back → CSS trượt ngược nối với data-slide=prev",
      prevSamples[0].nw.anim === "a6-slide-in-prev",
      `animationName=${prevSamples[0].nw.anim}`,
    );
  }

  // Ripple trên mọi nút.
  const btn = page.locator('button:not([disabled])').first();
  if (await btn.count()) {
    await btn.click({ noWaitAfter: true }).catch(() => {});
    const ripples = await page.locator(".a6-ripple").count();
    check("PRE-2 · ripple sinh ra khi bấm nút", ripples > 0, `count=${ripples}`);
  }

  // Điều hướng bằng bàn phím cũng phải có hiệu ứng (bấm giữa nút bằng Enter).
  check(
    "PRE-2 · không có lỗi console",
    errors.length === 0,
    errors.length ? errors.join(" | ") : serverErrors.length ? `(500 local: ${serverErrors.join(", ")})` : "",
  );
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
    await page.waitForTimeout(150);
    const s = await readSlide(page);
    const animating = s.nw.anim !== "none";
    check(
      "PRE-2 · reduced-motion → không trượt",
      !animating,
      animating ? `vẫn chạy ${s.nw.anim}` : "animationName=none",
    );
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
        return [...sheet.cssRules].some(
          (r) => r.cssText?.includes("a6-no-vt") && r.cssText.includes("view-transition"),
        );
      } catch {
        return false;
      }
    }),
  );
  check("PRE-2 · có CSS tắt chuyển cảnh cho a6-no-vt", ruleExists);

  // Cơ chế lớp phủ tròn bung ra toàn màn hình đã bị user yêu cầu xóa. Sót lại
  // là dấu hiệu chưa dọn hết — và nó sẽ chồng một lớp đặc đè lên transition.
  const coverLeft = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((r) => r.cssText?.includes("a6-cover"));
      } catch {
        return false;
      }
    }),
  );
  check("PRE-2 · đã xóa hết CSS lớp phủ bung tròn", !coverLeft);

  // Trong khi đó rules trượt phải tồn tại.
  const slideRules = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some(
          (r) => r.cssText?.includes("a6-slide") || r.cssText?.includes("view-transition-old(root)"),
        );
      } catch {
        return false;
      }
    }),
  );
  check("PRE-2 · có CSS trượt ngang", slideRules);
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) process.exit(1);