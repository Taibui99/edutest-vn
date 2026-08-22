const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1", hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto("https://edutest-vn.vercel.app/dang-nhap");
  await page.locator("#email").fill("admin-p2@edutest.vn");
  await page.locator("#password").fill("testpass");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForTimeout(6000);
  console.log("after login URL:", page.url());
  await page.goto("https://edutest-vn.vercel.app/admin");
  await page.waitForLoadState("networkidle").catch(()=>{});
  await page.waitForTimeout(3000);
  console.log("admin URL:", page.url());
  const body = await page.locator("body").innerText().catch(()=>"ERR");
  console.log("body 500:", body.slice(0,500));
  await browser.close();
})();
