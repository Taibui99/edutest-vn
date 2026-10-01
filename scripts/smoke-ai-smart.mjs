/**
 * Smoke test AI-4 tren production voi Gemini that.
 * Chay: node scripts/smoke-ai-smart.mjs
 * Luu y: goi Gemini that (ton quota), nen dung khi can xac nhan pipeline.
 */
import { chromium } from "@playwright/test";

const BASE = "https://edutest-vn.vercel.app";

// De trong = gan dap an trong tai lieu; co gia tri = bai co dap an san.
const SAMPLE = `ĐỀ THI GIÁO KHOA BÀI 3

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
`;

const run = async () => {
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
  await dialog.locator("textarea").first().fill(SAMPLE);
  const started = Date.now();
  await dialog.getByRole("button", { name: /Đọc tài liệu và dựng đề/i }).click();

  console.log("da gui, cho AI xu ly (toi da 7 phut)...");
  await page.waitForSelector('[role="dialog"] ol li', { timeout: 60_000 });

  // theo doi cac buoc
  const seen = new Set();
  const watcher = setInterval(async () => {
    try {
      for (const li of await dialog.locator("ol li").allInnerTexts()) seen.add(li.split("\n")[0]);
    } catch {}
  }, 2000);

  await dialog.getByRole("button", { name: /Áp dụng .* câu vào đề/i }).waitFor({ timeout: 420_000 });
  clearInterval(watcher);
  console.log(`AI xong sau ${Math.round((Date.now() - started) / 1000)}s`);

  const badges = await dialog.locator("span").filter({ hasText: /Đáp án có trong tài liệu|AI tự làm|Chưa có đáp án/ }).allInnerTexts();
  console.log("nguon dap an:", [...new Set(badges)].join(" | "));
  const reviewFlags = await dialog.locator("span").filter({ hasText: /Cần kiểm tra/ }).count();
  console.log("so cau 'can kiem tra':", reviewFlags);
  const summary = await dialog.locator("p").filter({ hasText: /câu/ }).allInnerTexts();
  console.log("tong hop:", summary.slice(0, 4).join(" // "));
  const selectedAnswers = await dialog.locator('input[type="radio"]:checked').count();
  console.log("so dap an da chon:", selectedAnswers);
  const notes = await dialog.locator("span").filter({ hasText: /lượt đồng thuận|phá thế hoản|cần giáo viên/ }).allInnerTexts();
  console.log("ghi chu giai:", [...new Set(notes)].join(" | "));

  await page.screenshot({ path: "qa-shots/ai-smart-review-live.png", fullPage: true });

  // ap dung vao editor
  await dialog.getByRole("button", { name: /Áp dụng .* câu vào đề/i }).click();
  await page.waitForTimeout(2500);
  const qCount = await page.getByText(/^\d+ câu · /).first().innerText().catch(() => "?");
  console.log("editor sau khi ap dung:", qCount);

  await browser.close();
};

run().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
