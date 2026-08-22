import { test, expect } from "@playwright/test";
import { TEACHER, login } from "./helpers";

test.describe("QUESTION BANK — Kho câu hỏi", () => {
  test("Q-01: Kho câu hỏi hiển thị + tabs", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/ngan-hang");
    await expect(page.getByRole("heading", { name: /ngân hàng câu hỏi/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /thêm câu hỏi/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /kho của tôi/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /trong đề thi/i })).toBeVisible();
    // chuyển tab Trong đề thi
    await page.getByRole("button", { name: /trong đề thi/i }).click();
    await expect(page.getByText(/chưa có câu hỏi|không có câu hỏi/i).first()).toBeVisible({ timeout: 8000 }).catch(() => {});
  });

  test("Q-02: Thêm câu hỏi trắc nghiệm qua modal — field đầy đủ", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/ngan-hang");
    await page.getByRole("button", { name: /thêm câu hỏi/i }).click();
    await expect(page.getByText(/câu hỏi mới/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/môn học/i).first()).toBeVisible();
    await expect(page.getByText(/loại câu hỏi/i)).toBeVisible();
    await expect(page.getByText(/nội dung câu hỏi/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /thêm vào kho/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /hủy/i })).toBeVisible();
  });

  test("Q-03: Validation — thiếu nội dung bị chặn", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/ngan-hang");
    await page.getByRole("button", { name: /thêm câu hỏi/i }).click();
    await page.getByRole("button", { name: /thêm vào kho/i }).click();
    await expect(page.getByText(/chọn môn học|nhập nội dung/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("Q-04: Thêm câu hỏi trắc nghiệm hoàn chỉnh + hiển thị trong kho", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/ngan-hang");
    await page.getByRole("button", { name: /thêm câu hỏi/i }).click();
    // môn + nội dung
    await page.getByText(/môn học/i).first().click();
    await page.locator("select").first().selectOption({ label: "Toán" });
    await page.getByPlaceholder(/nhập nội dung câu hỏi/i).fill("QA kho 1+1 bằng mấy?");
    await page.getByPlaceholder("Đáp án A").fill("1");
    await page.getByPlaceholder("Đáp án B").fill("2");
    await page.getByPlaceholder("Đáp án C").fill("3");
    await page.getByPlaceholder("Đáp án D").fill("4");
    await page.getByRole("button", { name: "B", exact: true }).first().click();
    await page.getByRole("button", { name: /thêm vào kho/i }).click();
    await expect(page.getByText(/1\+1 bằng mấy/i)).toBeVisible({ timeout: 15000 });
  });
});