import { test, expect, request as pwRequest } from "@playwright/test";
import { TEACHER, BASE_URL } from "./helpers";

/* iOS 15 / Safari 15: dưới sàn Next 16 + Tailwind 4 (cần Safari 16.4+) → app
 * chính không hydrate nổi React, bấm đáp án không ăn. Middleware phải trả HTTP
 * 307 đưa máy này sang hệ thống thi HTML thuần ở /thi-cu (xem proxy.ts). */
const IOS15_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1";

/* Tạo một đề dùng chung cho LEGACY-5/6 (chạm DB). Khách dùng cookie riêng nên
 * nhiều lượt khách trên cùng đề không đụng nhau. */
let CODE = "";

test.beforeAll(async () => {
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  const res = await req.post("/api/exams", {
    data: {
      title: `QA-LEGACY-${Date.now()}`,
      subject: "Toán",
      durationMinutes: 15,
      allowGuestAttempts: true,
      maxAttempts: 3,
      showAnswers: true,
      showScoreImmediately: true,
      questions: [
        { type: "mcq", question: "1+1=?", options: ["1", "2", "3", "4"], answer: "B", points: 1 },
        { type: "mcq", question: "2+2=?", options: ["3", "4", "5", "6"], answer: "B", points: 1 },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  CODE = (await res.json()).exam.joinCode;
  await req.dispose();
});

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

/* LEGACY-5 kiểm TRỌN luồng thi trên trang HTML thuần + đồng hồ đếm ngược.
 * Đồng hồ từng đứng ở "--:--" vì script nằm trong <head> (chạy trước <body> →
 * getElementById("tm") null → thoát sớm). Đây là regression test cho lỗi đó. */
test.describe("LEGACY-5 (DB) — khách thi trọn vẹn trên html thuần", () => {
  test.use({ userAgent: IOS15_UA });

  test("LEGACY-5: nhập tên → làm bài → nộp → 10/10 + xem lại + Làm lại", async ({ page }) => {
    await page.goto(`/thi/${CODE}`);
    expect(page.url()).toMatch(new RegExp(`/thi-cu/${CODE.toUpperCase()}$`));
    // Trang nhẹ tự chứa (không kéo React) và hiện form nhập tên.
    expect(await page.content()).not.toContain("/_next/static");
    await page.locator("#name").fill("Legacy Guest");
    await page.locator("#class").fill("12A1");
    await page.getByRole("button", { name: "Vào làm bài" }).click();
    // Vào được trang làm bài (server-render, một form POST).
    await expect(page.getByText("Câu 1").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Legacy Guest")).toBeVisible();
    // Đồng hồ đếm ngược PHẢI hiển thị (không đứng ở "--:--").
    const tm = page.locator("#tm");
    await expect(tm).toBeVisible();
    await expect(tm).not.toHaveText("--:--", { timeout: 5000 });
    await expect(tm).toHaveText(/^\d{2}:\d{2}$/);
    // Chọn đáp án đúng (B) cho mọi câu rồi nộp — KHÔNG cần JS.
    const correct = page.locator('input[type="radio"][value="B"]');
    const n = await correct.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) await correct.nth(i).check();
    await page.getByRole("button", { name: "Nộp bài" }).click();
    // Kết quả: điểm + xem lại đáp án (showAnswers) + nút Làm lại.
    await expect(page.getByText("Đã nộp bài").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("10/10").first()).toBeVisible();
    await expect(page.getByText("Xem lại bài làm").first()).toBeVisible();
    await page.getByRole("button", { name: "Làm lại" }).click();
    // Xoá cookie khách (action=leave) → quay lại form nhập tên.
    await expect(page.locator("#name")).toBeVisible({ timeout: 15000 });
  });
});

/* LEGACY-6: máy cũ nhất — JS tắt hẳn. Nộp bài phải chạy được bằng form POST
 * thuần (không phụ thuộc script nào). Đây là bảo hiểm cho đúng kịch bản iOS cũ. */
test.describe("LEGACY-6 (DB) — tắt JS vẫn thi và nộp được", () => {
  test.use({ userAgent: IOS15_UA, javaScriptEnabled: false });

  test("LEGACY-6: JS tắt → nhập tên → làm → nộp (native POST) → 10/10", async ({ page }) => {
    await page.goto(`/thi/${CODE}`);
    expect(page.url()).toMatch(new RegExp(`/thi-cu/${CODE.toUpperCase()}$`));
    await page.locator("#name").fill("NoJS Guest");
    await page.locator("#class").fill("9A");
    await page.getByRole("button", { name: "Vào làm bài" }).click();
    await expect(page.getByText("Câu 1").first()).toBeVisible({ timeout: 15000 });
    // Chọn đáp án bằng bấm nhãn (không cần JS của trang).
    const labels = page.locator('label.opt:has(input[value="B"])');
    const n = await labels.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) await labels.nth(i).click();
    await page.getByRole("button", { name: "Nộp bài" }).click();
    await expect(page.getByText("Đã nộp bài").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("10/10").first()).toBeVisible();
  });
});

/* LEGACY-7: lưới đỡ cho LINK CHIA SẺ DUY NHẤT. Mô phỏng máy bị "đoán nhầm UA":
 * UA hiện đại (middleware KHÔNG chuyển) nhưng bundle React không tải nổi (chặn
 * /_next/static) → trang phải TỰ chuyển sang /thi-cu nhờ script fallback. Nhờ
 * vậy chỉ cần một link/QR cho mọi thiết bị. */
test.describe("LEGACY-7 — lưới đỡ: React chết vẫn tự sang bản nhẹ", () => {
  test("chặn bundle React → tự chuyển /thi-cu/<CODE>", async ({ page }) => {
    await page.route("**/_next/static/**", (route) => route.abort());
    await page.goto(`/thi/${CODE}`);
    // Middleware (UA hiện đại) KHÔNG chuyển — phải do script fallback lo.
    expect(page.url()).not.toMatch(/\/thi-cu\//);
    await page.waitForURL(new RegExp(`/thi-cu/${CODE.toUpperCase()}$`), { timeout: 20000 });
    // Đã sang bản nhẹ: thấy form nhập tên HTML thuần.
    await expect(page.getByRole("button", { name: "Vào làm bài" })).toBeVisible({ timeout: 15000 });
  });
});
