import { test, expect, request as pwRequest } from "@playwright/test";
import { STUDENT, TEACHER, login, BASE_URL } from "./helpers";

let CODE = "43WTBE";

test.beforeAll(async () => {
  // Tạo exam riêng cho Playwright với maxAttempts cao để không vướng dữ liệu cũ
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  const examBody = {
    title: `QA-PW-Exam-${Date.now()}`,
    subject: "Toán",
    durationMinutes: 15,
    allowGuestAttempts: true,
    maxAttempts: 5,
    showAnswers: true,
    showScoreImmediately: true,
    // S-05 cần theo dõi rời trang BẬT (mode off thì không gắn listener).
    proctorMode: "light",
    questions: [
      { type: "mcq", question: "1+1=?", options: ["1", "2", "3", "4"], answer: "B", points: 1 },
      { type: "mcq", question: "2+2=?", options: ["3", "4", "5", "6"], answer: "B", points: 1 },
    ],
  };
  const res = await req.post("/api/exams", { data: examBody });
  expect(res.status()).toBe(201);
  const data = await res.json();
  CODE = data.exam.joinCode;
  await req.dispose();
});

test.describe("STUDENT — Làm bài thi", () => {
  test("S-01: Vào thi bằng mã hợp lệ", async ({ page }) => {
    await page.goto("/vao-thi");
    await page.locator("input[placeholder='VD: ABC123']").fill(CODE);
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await expect(page.getByText(/QA-PW-Exam/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("S-02: Nhập mã sai → báo lỗi", async ({ page }) => {
    await page.goto("/vao-thi");
    await page.locator("input[placeholder='VD: ABC123']").fill("ZZZZ99");
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await expect(page.getByText(/mã tham gia không hợp lệ|không tồn tại/i)).toBeVisible({ timeout: 15000 });
  });

  test("S-03: Làm bài MCQ + nộp bài", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(`/thi/${CODE}`);
    await expect(page.getByText("Câu 1/2").first()).toBeVisible({ timeout: 15000 });
    // Trả lời câu MCQ đầu tiên (1+1=2 → B)
    await page.getByRole("button", { name: /^B/ }).first().click();
    await page.getByRole("button", { name: /nộp bài/i }).first().click();
    // Confirm dialog xuất hiện vì còn câu chưa trả lời
    await page.getByRole("button", { name: "Nộp bài" }).last().click();
    await expect(page.getByText(/đã nộp|nộp bài thành công|\/10/i).first()).toBeVisible({ timeout: 20000 });
  });

  test("S-04: Guest làm bài bằng mã", async ({ page }) => {
    await page.goto("/vao-thi");
    await page.locator("input[placeholder='VD: ABC123']").fill(CODE);
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await page.getByPlaceholder("Nguyễn Văn A").fill("Guest Playwright");
    await page.getByPlaceholder("12A6").fill("12A9");
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await expect(page.getByText("Câu 1/2").first()).toBeVisible({ timeout: 15000 });
    // Regression (bug "vòng lặp nhập tên" trên iPhone): sau khi khách tham gia,
    // router.refresh() tái tạo preloader (HTML thô) NHƯNG script inline không
    // chạy lại → overlay mới đứng ở 0% che kín màn hình. Phải KHÔNG còn overlay
    // hiện (script tự ẩn mọi preloader bị tái tạo sau khi trang tải).
    await expect(page.locator("#a6-preloader")).toBeHidden({ timeout: 12000 });
  });

  test("S-05: Anti-cheat — blur 1 lần → toast cảnh báo (sau ân hạn)", async ({ page }) => {
    // Test này cố tình chờ HẾT ân hạn 30s rồi chờ dư tới 40s để toast hiện →
    // tổng thời lượng ~70s, vượt mặc định 60s. Nới riêng cho ca này.
    test.setTimeout(120000);
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto(`/thi/${CODE}`);
    await expect(page.getByText("Câu 1/2").first()).toBeVisible({ timeout: 15000 });
    // HTML render từ server hiện title TRƯỚC khi React hydrate — listener `blur`
    // chỉ gắn sau khi client chạy. Chờ đồng hồ nhảy 1 nhịp rồi mới bắn blur,
    // nếu không event bị bắn vào lúc chưa có người nghe → mất vô hại.
    const timer = page.locator("header").getByText(/^\d{1,2}:\d{2}$/).first();
    await expect(timer).toBeVisible({ timeout: 15000 });
    const firstTick = (await timer.textContent()) ?? "";
    await expect(timer).not.toHaveText(firstTick, { timeout: 8000 });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    // Ân hạn 30s cho rời trang bị động (nới cho iPhone tự khoá màn hình): toast
    // chỉ hiện khi vẫn đi sau 30s → chờ dư 40s. Việc chạm ngưỡng KHÔNG tự nộp
    // nữa (IOS-1a), nên bên dưới test nộp thủ công để nhả activeKey.
    await expect(page.getByText(/phát hiện rời khỏi bài thi/i).first()).toBeVisible({ timeout: 40000 });
    // Nộp bài để giải phóng activeKey — attempt đang mở (chưa nộp) sẽ chặn lần
    // thi sau: project kia chạy cùng tài khoản, hoặc lần chạy kế tiếp.
    await page.getByRole("button", { name: /nộp bài/i }).first().click();
    await page.getByRole("button", { name: "Nộp bài" }).last().click();
    await expect(page.getByText(/đã nộp|nộp bài thành công|\/10/i).first()).toBeVisible({ timeout: 20000 });
  });

  test("S-06: Guest nộp bài → xem lại đáp án + nút Làm lại", async ({ page }) => {
    await page.goto("/vao-thi");
    await page.locator("input[placeholder='VD: ABC123']").fill(CODE);
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await page.getByPlaceholder("Nguyễn Văn A").fill("Guest Review");
    await page.getByPlaceholder("12A6").fill("12A9");
    await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
    await expect(page.getByText("Câu 1/2").first()).toBeVisible({ timeout: 15000 });
    // Trả lời câu 1 (1+1=2 → B) rồi nộp (còn câu chưa trả lời → có hộp xác nhận).
    await page.getByRole("button", { name: /^B/ }).first().click();
    await page.getByRole("button", { name: /nộp bài/i }).first().click();
    await page.getByRole("button", { name: "Nộp bài" }).last().click();
    // GUEST-4: khách (không có /bang-dieu-khien) phải thấy bảng "Xem lại bài làm"
    // ngay trong runner + nút "Làm lại". Đề QA bật showAnswers nên review hiện.
    await expect(page.getByText("Xem lại bài làm").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Câu 1\./).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Làm lại" })).toBeVisible();
  });
});
