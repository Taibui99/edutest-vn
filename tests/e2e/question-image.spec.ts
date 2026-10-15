import { test, expect } from "@playwright/test";
import { TEACHER, login } from "./helpers";

/* IMG-1 — chèn ảnh minh hoạ vào câu hỏi:
 *  tải ảnh lên kho công khai → gắn URL vào `grading.image` → học sinh thấy ảnh
 *  ở cả trang thi React lẫn bản HTML thuần cho máy iOS cũ.
 * Chạy trên production (baseURL mặc định). */

// PNG 1x1 trong suốt — đủ để đi hết đường tải lên.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const IMG_ALT = "Hình minh hoạ câu hỏi";

test.describe.configure({ mode: "serial" });

let CODE = "";

test("IMG-1: tải ảnh lên kho + tạo đề có ảnh", async ({ page }) => {
  test.setTimeout(120000);
  await login(page, TEACHER.email, TEACHER.password);

  const up = await page.request.post("/api/uploads/question-image", {
    multipart: { file: { name: "anh.png", mimeType: "image/png", buffer: PNG_1x1 } },
  });
  expect(up.status(), await up.text()).toBe(200);
  const uploaded = (await up.json()) as { url?: string };
  expect(uploaded.url).toBeTruthy();
  expect(uploaded.url).toContain("/storage/v1/object/public/question-images/");

  const res = await page.request.post("/api/exams", {
    data: {
      title: `QA-IMG-${Date.now()}`,
      subject: "Toán",
      durationMinutes: 15,
      allowGuestAttempts: true,
      maxAttempts: 1,
      showAnswers: true,
      showScoreImmediately: true,
      questions: [
        {
          type: "mcq",
          question: "Hình bên dưới là gì?",
          options: ["Hình vuông", "Hình tròn", "Tam giác", "Ngôi sao"],
          answer: "A",
          points: 1,
          grading: { image: uploaded.url },
        },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  CODE = ((await res.json()) as { exam: { joinCode: string } }).exam.joinCode;
});

test("IMG-1: học sinh (khách) thấy ảnh khi làm bài", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(`/thi/${CODE}`);
  await page.locator('input[name="name"]').fill("QA Ảnh");
  await page.locator('input[name="class"]').fill("12A1");
  await page.getByRole("button", { name: /Bắt đầu làm bài/i }).click();

  const img = page.getByAltText(IMG_ALT).first();
  await expect(img).toBeVisible({ timeout: 30000 });
  // Ảnh phải tải được thật (bucket công khai + CSP cho phép ảnh Supabase).
  await expect
    .poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 20000 })
    .toBeGreaterThan(0);
});

test("IMG-1: bản HTML cho máy iOS cũ cũng hiện ảnh", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(`/thi-cu/${CODE}`);
  await page.locator("#name").fill("QA Cũ");
  await page.locator("#class").fill("12A2");
  await page.getByRole("button", { name: /Vào làm bài/i }).click();

  await expect(page.locator(".qimg").first()).toBeVisible({ timeout: 30000 });
  await expect
    .poll(async () => page.locator(".qimg").first().evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 20000 })
    .toBeGreaterThan(0);
});
