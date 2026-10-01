import { chromium } from "@playwright/test";

const BASE = "https://edutest-vn.vercel.app";
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
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /^Đóng$/ }).click();
  await page.waitForTimeout(600);

  const difficultyBtns = page.getByRole("button", { name: "nhận biết", exact: true });
  console.log("selector do kho 'nhan biet':", await difficultyBtns.count());
  console.log("co nut 'vân dung':", await page.getByRole("button", { name: "vận dụng", exact: true }).count());
  console.log("nhap biet duoc chon mac dinh:", (await difficultyBtns.first().getAttribute("aria-pressed")) === "true");
  console.log("co muc 'do kho':", (await page.getByText("Độ khó", { exact: true }).count()) > 0);

  await page.screenshot({ path: "qa-shots/ai-smart-editor-difficulty.png", fullPage: false });

  await page.getByRole("button", { name: /import pdf\/word/i }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "qa-shots/ai-smart-modal-smart.png", fullPage: false });
  await page.getByRole("button", { name: /AI soạn câu hỏi mới/i }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "qa-shots/ai-smart-modal-generate.png", fullPage: false });
  console.log("tab generate chon:", (await page.getByRole("button", { name: /AI soạn câu hỏi mới/i }).getAttribute("aria-pressed")) === "true");

  await browser.close();
};
run().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
