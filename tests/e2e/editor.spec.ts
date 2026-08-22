import { test, expect } from "@playwright/test";
import { TEACHER, login, timestamp } from "./helpers";

test.describe("EDITOR — Tạo đề 4 loại câu + xuất bản", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
  });

  test("E-01: Editor hiển thị đủ: 4 loại câu, thông tin đề, cấu hình", async ({ page }) => {
    await page.goto("/bang-dieu-khien/tao-de-thi");
    await expect(page.getByRole("heading", { name: /tạo đề thi/i })).toBeVisible({ timeout: 20000 });
    // select loại câu có 4 options
    const typeSelect = page.locator("main select").nth(0);
    await expect(typeSelect).toBeVisible();
    const opts = await typeSelect.locator("option").allTextContents();
    expect(opts).toEqual(expect.arrayContaining(["Trắc nghiệm", "Đúng / Sai", "Trả lời ngắn", "Tự luận"]));
    // nút thêm câu
    await expect(page.getByRole("button", { name: /thêm câu/i })).toBeVisible();
    // thông tin đề
    await expect(page.getByText("Tên đề thi")).toBeVisible();
    await expect(page.getByText("Môn học").first()).toBeVisible();
    // cấu hình
    await expect(page.getByText("Trộn câu hỏi")).toBeVisible();
    await expect(page.getByText("Cho phép khách làm bài")).toBeVisible();
    await expect(page.getByText("Hiển thị điểm ngay sau khi nộp")).toBeVisible();
    // nút chính
    await expect(page.getByRole("button", { name: /import pdf\/word/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /xem trước/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /lưu nháp/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /xuất bản/i })).toBeVisible();
  });

  test("E-02: Xuất bản bị chặn khi thiếu tên/môn (nút disabled)", async ({ page }) => {
    await page.goto("/bang-dieu-khien/tao-de-thi");
    await expect(page.getByText("1 lỗi cần sửa")).toBeVisible({ timeout: 20000 });
    const publishBtn = page.getByRole("button", { name: /xuất bản/i });
    await expect(publishBtn).toBeDisabled();
  });

  test("E-03: Tạo đề MCQ 1 câu + Xuất bản thành công", async ({ page }) => {
    await page.goto("/bang-dieu-khien/tao-de-thi");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    // điền tên đề
    await page.getByText("Tên đề thi").click();
    const titleInput = page.getByPlaceholder("VD: Kiểm tra chương 1");
    await titleInput.fill(`QA Editor ${timestamp()}`);
    // chọn môn
    const subjectSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "Toán" }) });
    await subjectSelect.selectOption({ label: "Toán" });
    // nội dung câu hỏi
    await page.getByPlaceholder("Nhập nội dung câu hỏi...").fill("1+1 bằng mấy?");
    // đáp án A-D
    await page.getByPlaceholder("Đáp án A").fill("1");
    await page.getByPlaceholder("Đáp án B").fill("2");
    await page.getByPlaceholder("Đáp án C").fill("3");
    await page.getByPlaceholder("Đáp án D").fill("4");
    // chọn đáp án đúng B
    await page.getByRole("button", { name: "B", exact: true }).click();
    // chờ nút xuất bản được enable (React đã hydrate + form hợp lệ)
    const publishBtn = page.getByRole("button", { name: /xuất bản/i });
    await expect(publishBtn).toBeEnabled({ timeout: 15000 });
    await publishBtn.click();
    await page.waitForURL(/\/bang-dieu-khien\?created=/, { timeout: 25000 });
    await expect(page.getByText(/đã xuất bản đề thi/i)).toBeVisible({ timeout: 15000 });
  });

  test("E-04: Thêm câu Tự luận đổi loại câu", async ({ page }) => {
    await page.goto("/bang-dieu-khien/tao-de-thi");
    // câu đầu: đổi loại thành Tự luận
    const typeSelect = page.locator("main select").nth(0);
    await typeSelect.selectOption({ label: "Tự luận" });
    await expect(page.getByText(/câu tự luận sẽ được giáo viên chấm thủ công/i)).toBeVisible({ timeout: 5000 });
  });

  test("E-05: Nút Đề mới reset về 1 câu trống", async ({ page }) => {
    await page.goto("/bang-dieu-khien/tao-de-thi");
    await page.getByRole("button", { name: /đề mới/i }).click();
    await expect(page.getByText(/1 câu · 1 lỗi cần sửa/)).toBeVisible({ timeout: 5000 });
  });
});
