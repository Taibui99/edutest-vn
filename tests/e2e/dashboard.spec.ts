import { test, expect } from "@playwright/test";
import { TEACHER, STUDENT, login } from "./helpers";

test.describe("DASHBOARD — Bảng điều khiển", () => {
  test("D-01: Dashboard teacher — stats + quick actions", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien");
    await expect(page.getByRole("link", { name: /tạo đề thi mới/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("link", { name: /thống kê/i }).first()).toBeVisible();
    await expect(page.getByText(/đề thi đã tạo/i).first()).toBeVisible();
  });

  test("D-02: Dashboard student — banner chào + quick actions", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien");
    await expect(page.getByText(/chào/i).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("link", { name: /vào thi/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /học tập/i }).first()).toBeVisible();
    await expect(page.getByText(/bài thi gần đây/i).first()).toBeVisible();
    await expect(page.getByText(/ai study coach/i).first()).toBeVisible();
  });

  test("D-03: Sidebar teacher — đủ 8 menu (bản production)", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien");
    await page.waitForTimeout(1500);
    const isMobile = test.info().project.name === "mobile";
    const menu = isMobile
      ? [
          { text: "Dashboard", href: "/bang-dieu-khien" },
          { text: "Đề", href: "/bang-dieu-khien/de-thi" },
          { text: "Lớp", href: "/bang-dieu-khien/lop-hoc" },
          { text: "AI", href: "/bang-dieu-khien/ai" },
          { text: "More", href: "/bang-dieu-khien/thong-ke" },
        ]
      : [
          { text: "Tổng quan", href: "/bang-dieu-khien" },
          { text: "Đề thi", href: "/bang-dieu-khien/de-thi" },
          { text: "Tạo đề", href: "/bang-dieu-khien/tao-de-thi" },
          { text: "Lớp học", href: "/bang-dieu-khien/lop-hoc" },
          { text: "Học sinh", href: "/bang-dieu-khien/hoc-sinh" },
          { text: "Ngân hàng câu hỏi", href: "/bang-dieu-khien/ngan-hang" },
          { text: "AI tạo đề", href: "/bang-dieu-khien/ai" },
          { text: "Thống kê", href: "/bang-dieu-khien/thong-ke" },
        ];
    for (const item of menu) {
      const link = page.locator(`nav a[href="${item.href}"]`).filter({ visible: true }).first();
      await expect(link).toBeVisible({ timeout: 10000 });
      await expect(link).toHaveText(new RegExp(item.text.replace(/\//g, "\\/"), "i"));
    }
  });

  test("D-04: Sidebar student — menu học tập/tiến độ/AI", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien");
    await page.waitForTimeout(1500);
    const isMobile = test.info().project.name === "mobile";
    const menu = isMobile
      ? [
          { text: "Home", href: "/bang-dieu-khien" },
          { text: "Học", href: "/bang-dieu-khien/hoc-tap" },
          { text: "Tiến độ", href: "/bang-dieu-khien/tien-do" },
          { text: "Đề", href: "/bang-dieu-khien/de-thi" },
          { text: "Profile", href: "/bang-dieu-khien/ho-so" },
        ]
      : [
          { text: "Tổng quan", href: "/bang-dieu-khien" },
          { text: "Học tập", href: "/bang-dieu-khien/hoc-tap" },
          { text: "Tiến độ", href: "/bang-dieu-khien/tien-do" },
          { text: "Đề thi", href: "/bang-dieu-khien/de-thi" },
          { text: "AI Coach", href: "/bang-dieu-khien/ai" },
        ];
    for (const item of menu) {
      const link = page.locator(`nav a[href="${item.href}"]`).filter({ visible: true }).first();
      await expect(link).toBeVisible({ timeout: 10000 });
    }
  });
});
