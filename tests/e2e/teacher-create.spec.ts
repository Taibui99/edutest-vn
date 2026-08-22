import { test, expect } from "@playwright/test";
import { TEACHER, login } from "./helpers";

test.describe("TEACHER — Tạo đề & quản lý", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
  });

  test("T-01: Tạo đề trắc nghiệm + xuất bản", async ({ page }) => {
    const title = `QA-De-Toan-${Date.now()}`;
    await page.goto("/bang-dieu-khien/tao-de-thi");
    await page.getByLabel("Tên đề thi").fill(title);
    await page.getByLabel("Môn học").selectOption({ label: "Toán" });

    // Câu hỏi MCQ đầu tiên
    const questionCard = page.locator("textarea[placeholder='Nhập nội dung câu hỏi...']").first();
    await questionCard.fill("1+1 bang may?");
    const options = page.locator("input[placeholder^='Đáp án']");
    await options.nth(0).fill("1");
    await options.nth(1).fill("2");
    await options.nth(2).fill("3");
    await options.nth(3).fill("4");
    await page.locator("button").filter({ hasText: /^B$/ }).first().click();

    await page.getByRole("button", { name: "Xuất bản" }).click();
    await expect(page).toHaveURL(/bang-dieu-khien/, { timeout: 20000 });
    test.info().annotations.push({ type: "note", description: `Đã tạo đề: ${title}` });
  });

  test("T-02: Tạo đề thiếu tên → nút Xuất bản bị vô hiệu", async ({ page }) => {
    await page.goto("/bang-dieu-khien/tao-de-thi");
    await expect(page.getByRole("button", { name: "Xuất bản" })).toBeDisabled();
  });

  test("T-03: Danh sách đề hiển thị", async ({ page }) => {
    await page.goto("/bang-dieu-khien/de-thi");
    await page.waitForLoadState("networkidle");
    const hasHeading = await page.getByRole("heading").count();
    expect(hasHeading).toBeGreaterThan(0);
    await expect(page.getByText("Đề thi").last()).toBeVisible();
  });
});
