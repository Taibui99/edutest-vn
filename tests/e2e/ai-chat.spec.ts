import { test, expect } from "@playwright/test";
import { STUDENT, login } from "./helpers";

test.describe("AI CHAT — Study Coach", () => {
  test("AI-01: Trang AI hiển thị chat + quick prompts", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/ai");
    await expect(page.getByText("AI Study Coach").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /cuộc trò chuyện mới/i }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.locator("textarea").first()).toBeVisible();
  });

  test("AI-02: Gửi tin nhắn → AI trả lời", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/ai");
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 20000 });
    await textarea.fill("Chào bạn, hãy giới thiệu về bạn");
    await page.keyboard.press("Enter");
    // chờ AI phản hồi (reply chứa "Mình là AI hội thoại")
    await expect(page.getByText(/mình là ai hội thoại/i)).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: `evidence/ai-chat-${test.info().project.name}.png`, fullPage: true });
  });
});