import { test, expect } from "@playwright/test";
import { TEACHER, STUDENT, login } from "./helpers";

test.describe("RBAC — Phân quyền", () => {
  test("RB-01: Guest truy cập dashboard → redirect login", async ({ page }) => {
    await page.goto("/bang-dieu-khien");
    await expect(page).toHaveURL(/\/dang-nhap/, { timeout: 15000 });
  });

  test("RB-02: Guest truy cập /admin → redirect login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dang-nhap/, { timeout: 15000 });
  });

  test("RB-03: Student vào /admin → redirect dashboard", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/bang-dieu-khien/, { timeout: 15000 });
  });

  test("RB-04: Student vào /tao-de-thi → redirect dashboard", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/tao-de-thi");
    await expect(page).toHaveURL(/\/bang-dieu-khien$/, { timeout: 15000 });
  });

  test("RB-05: Teacher vào /admin → redirect dashboard", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/bang-dieu-khien/, { timeout: 15000 });
  });

  test("RB-06: Teacher vào /hoc-tap (student route) → redirect dashboard", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/hoc-tap");
    await expect(page).toHaveURL(/\/bang-dieu-khien$/, { timeout: 15000 });
  });

  test("RB-07: Đã đăng nhập, mở /dang-nhap → redirect dashboard", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/dang-nhap");
    await expect(page).toHaveURL(/\/bang-dieu-khien/, { timeout: 15000 });
  });

  test("RB-08: Student xem teacher API /api/exams → 403", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    const resp = await page.request.get("/api/exams");
    expect(resp.status()).toBe(403);
  });
});
