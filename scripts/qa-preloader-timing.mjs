import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://edutest-vn.vercel.app";
const browser = await chromium.launch();

/**
 * Ghi lại chuỗi % thực sự hiển thị, kèm ms, để chứng minh con số có BƠM hay
 * chỉ nhảy thẳng. Kết quả mong đợi sau khi sửa: nhiều mốc tăng dần, đi từ ~0
 * lên ~88 trước khi nhảy 100.
 */
async function trace(page, url) {
  await page.goto(url, { waitUntil: "commit" });
  const t0 = Date.now();
  const samples = [];
  let last = null;
  let appeared = false;

  for (let i = 0; i < 600; i++) {
    const s = await page.evaluate(() => {
      const el = document.querySelector("#a6-preloader");
      if (!el) return null;
      const liquid = document.querySelector(".a6-pl-liquid");
      return {
        pct: Number(document.querySelector(".a6-pl-pct")?.textContent?.replace(/\D/g, "")),
        burst: el.getAttribute("data-burst") === "true",
        liquidH: liquid ? Math.round(parseFloat(getComputedStyle(liquid).height)) : null,
        vh: window.innerHeight,
      };
    });

    // Preloader là React component trong <body>: với `waitUntil: "commit"` DOM
    // chưa parse nên nó chưa tồn tại. Chưa thấy KHÔNG phải là đã biến mất —
    // phải chờ nó xuất hiện trước, rồi mới bắt đầu đo.
    if (s === null) {
      if (appeared) { samples.push({ ms: Date.now() - t0, gone: true }); break; }
      await page.waitForTimeout(16);
      continue;
    }

    appeared = true;
    if (s.pct !== last) {
      last = s.pct;
      samples.push({
        ms: Date.now() - t0,
        pct: s.pct,
        burst: s.burst,
        liquidPct: s.liquidH !== null && s.vh ? Math.round((s.liquidH / s.vh) * 100) : null,
      });
    }
    await page.waitForTimeout(16);
  }
  return samples;
}

const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const s = await trace(page, BASE);

const shown = s.filter((x) => typeof x.pct === "number");
console.log(`so moc % thay doi: ${shown.length}`);
console.log("ms    %   cot-chat-long");
for (const x of s) {
  if (x.gone) { console.log(String(x.ms).padEnd(6), "-- overlay da go"); break; }
  console.log(
    String(x.ms).padEnd(6),
    String(x.pct).padStart(3),
    `${x.liquidPct}%`,
    x.burst ? " (burst)" : ""
  );
}
const pct100 = shown.find((x) => x.pct === 100);
console.log("\nnhan 100% sau:", pct100 ? pct100.ms + "ms" : "KHONG BAO GIO");
console.log("co moc trung gian (khong phai nhay thang):", shown.some((x) => x.pct > 1 && x.pct < 80) ? "CO" : "KHONG");

await browser.close();