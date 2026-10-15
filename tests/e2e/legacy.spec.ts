import { test, expect } from "@playwright/test";

/* iOS 15 / Safari 15: dưới sàn Next 16 + Tailwind 4 (cần Safari 16.4+) → app
 * chính không hydrate nổi React, bấm đáp án không ăn. Middleware phải trả HTTP
 * 307 đưa máy này sang hệ thống thi HTML thuần ở /thi-cu (xem proxy.ts). */
const IOS15_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1";

test.describe("LEGACY — máy iOS cũ được đưa sang hệ thống thi HTML thuần", () => {
  test.describe("UA iOS 15", () => {
    test.use({ userAgent: IOS15_UA });

    test("LEGACY-1: /thi/<code> → chuyển sang /thi-cu/<CODE> (HTML thuần, không React)", async ({ page }) => {
      const res = await page.goto("/thi/zzzz");
      expect(page.url()).toMatch(/\/thi-cu\/ZZZZ$/);
      expect(res?.status()).toBeGreaterThanOrEqual(200);
      const html = await page.content();
      // Trang nhẹ tự chứa: KHÔNG kéo bundle/asset của Next (React).
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).not.toContain("/_next/static");
    });
  });

  test("LEGACY-2: trình duyệt mới → KHÔNG chuyển hướng", async ({ page }) => {
    await page.goto("/thi/zzzz");
    expect(page.url()).not.toMatch(/\/thi-cu\//);
    expect(page.url()).toMatch(/\/thi\/zzzz$/);
  });

  test("LEGACY-3: ?legacy=1 ép dùng bản nhẹ (mã chuẩn hoá chữ HOA)", async ({ page }) => {
    await page.goto("/thi/ab12cd?legacy=1");
    expect(page.url()).toMatch(/\/thi-cu\/AB12CD$/);
  });

  test("LEGACY-4: ?preview=1 (giáo viên) → giữ nguyên bản đầy đủ", async ({ page }) => {
    await page.goto("/thi/zzzz?preview=1");
    expect(page.url()).toMatch(/\/thi\/zzzz\?preview=1$/);
  });
});
