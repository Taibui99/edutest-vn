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
  ["/bang-dieu-khien/ho-so", "hoso"],
];

const width = Number(process.argv[2] || 390);
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
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
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `qa-shots/${width}-${name}.png`, fullPage: true });
  console.log(name, "ok");
}
await browser.close();