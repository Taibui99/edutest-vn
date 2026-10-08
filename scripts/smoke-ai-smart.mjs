/**
 * Smoke test AI-4 tren production voi Gemini that (ton quota).
 * Chay: node scripts/smoke-ai-smart.mjs          -> de co dap an san trong tai lieu
 *       node scripts/smoke-ai-smart.mjs --solve  -> de THIEU dap an, AI tu giai 2 luot
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "https://edutest-vn.vercel.app";
const SOLVE_MODE = process.argv.includes("--solve");

const DOC_WITH_KEY = `ĐỀ THI GIÁO KHOA BÀI 3

Câu 1: Trong các hành động sau, hành động nào thuộc chủ thể?
A. Học tập
B. Nhặt rác
C. Đi xe
D. Ngủ

Câu 2: Đơn vị đo cường độ âm thanh là gì?
A. Mét
B. Kilogram
C. Decibel
D. Lít

Câu 3: Hành động có chủ thể là người nào?
A. Cây cỏ
B. Con người
C. Chiếc bàn
D. Ngôi sao

ĐÁP ÁN: 1.A 2.C 3.B`;

const DOC_NO_KEY = DOC_WITH_KEY.replace(/\n\nĐÁP ÁN:.*$/s, "");

const run = async () => {
  const sample = SOLVE_MODE ? DOC_NO_KEY : DOC_WITH_KEY;
  console.log("che do:", SOLVE_MODE ? "thieu dap an (AI tu giai)" : "co dap an san trong tai lieu");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "vi-VN" });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/dang-nhap`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill("tester-gv-20260816@edutest.vn");
  await page.locator("#password").fill("Test@12345");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/bang-dieu-khien/, { timeout: 30000 });

  await page.goto(`${BASE}/bang-dieu-khien/tao-de-thi`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /import pdf\/word/i }).click();
  await page.waitForTimeout(800);

  const dialog = page.getByRole("dialog");
  await dialog.locator("textarea").first().fill(sample);
  const started = Date.now();
  await dialog.getByRole("button", { name: /Đọc tài liệu và dựng đề/i }).click();
  await page.waitForSelector('[role="dialog"] ol li', { timeout: 60_000 });
  await dialog.getByRole("button", { name: /Áp dụng .* câu vào đề/i }).waitFor({ timeout: 420_000 });
  console.log(`AI xong sau ${Math.round((Date.now() - started) / 1000)}s`);

  const badges = await dialog.locator("span").filter({ hasText: /Đáp án có trong tài liệu|AI tự làm|Chưa có đáp án/ }).allInnerTexts();
  console.log("nguon dap an:", [...new Set(badges)].join(" | "));
  console.log("so cau 'can kiem tra':", await dialog.locator("span").filter({ hasText: /Cần kiểm tra/ }).count());
  const summary = await dialog.locator("p").filter({ hasText: /câu/ }).allInnerTexts();
  console.log("tong hop:", summary.slice(0, 3).join(" // "));
  console.log("so dap an da chon:", await dialog.locator('input[type="radio"]:checked').count());
  const notes = await dialog.locator("span").filter({ hasText: /lượt đồng thuận|phá thế hoản|cần giáo viên/ }).allInnerTexts();
  console.log("ghi chu giai:", [...new Set(notes)].join(" | "));
  const letters = await dialog.locator('input[type="radio"]:checked').evaluateAll((els) =>
    els.map((el) => el.closest("label")?.querySelector("span")?.textContent?.trim()),
  );
  console.log("dap an tung cau:", letters.join(", "));

  await page.screenshot({ path: `qa-shots/ai-smart-review-${SOLVE_MODE ? "solve" : "key"}.png`, fullPage: true });

  await dialog.getByRole("button", { name: /Áp dụng .* câu vào đề/i }).click();
  await page.waitForTimeout(2500);
  console.log("editor sau khi ap dung:", await page.getByText(/^\d+ câu · /).first().innerText().catch(() => "?"));

  await browser.close();
};

run().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
