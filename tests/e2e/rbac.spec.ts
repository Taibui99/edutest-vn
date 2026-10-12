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

  test("RB-06: Teacher vào /tien-do (student route) → redirect dashboard", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/tien-do");
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

  test("RB-09 (G6b): Student bật chế độ GV → tạo đề được, chỉ thấy đề mình", async ({ page }) => {
    // Đổi mode qua hub rồi CHỜ thẻ mode hiện "Đang dùng" (server action
    // re-encode JWT bất đồng bộ — gọi API ngay sẽ race với cookie cũ và 403 oan).
    const switchMode = async (label: "Giáo viên" | "Học sinh") => {
      await page.goto("/bang-dieu-khien");
      await expect(page.getByText("Đang dùng").first()).toBeVisible({ timeout: 20000 });
      // Hydrate xong hay chưa không nhìn được từ DOM ("Đang dùng" là HTML
      // server), mà bấm trước khi handler gắn thì im lặng không mở dialog.
      // Bấm → kiểm dialog → chưa mở thì đợi rồi bấm lại, tối đa 5 lần.
      let opened = false;
      for (let i = 0; i < 5 && !opened; i++) {
        // Scope trong main: ngoài sidebar có link "Học sinh" trùng chữ —
        // không scope là bấm nhầm link, bay sang /hoc-sinh thay vì mở dialog.
        await page.locator("main").getByText(label, { exact: true }).click();
        await page.waitForTimeout(1200);
        opened = (await page.getByRole("heading", { name: /chuyển sang chế độ/i }).count()) > 0;
        if (!opened) await page.waitForTimeout(2000);
      }
      expect(opened).toBe(true);
      await page.getByRole("button", { name: "Chuyển chế độ" }).click();
      const card = page.locator("main button", { hasText: label }).first();
      await expect(card.getByText("Đang dùng")).toBeVisible({ timeout: 25000 });
    };

    await login(page, STUDENT.email, STUDENT.password);
    await switchMode("Giáo viên");

    // tạo đề ở chế độ GV → 201 (trước G6b là 403)
    const title = `QA-Mode-${Date.now()}`;
    const created = await page.request.post("/api/exams", {
      data: {
        title, subject: "Toán", durationMinutes: 15, status: "draft",
        questions: [{ type: "mcq", question: "1+1?", options: ["1", "2", "3", "4"], answer: "B" }],
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const { exam } = await created.json();

    // danh sách chỉ có đề mình vừa tạo (không rò đề của GV khác)
    const list = await page.request.get("/api/exams");
    expect(list.status()).toBe(200);
    const ids = ((await list.json()).exams ?? []).map((e: { id: string }) => e.id);
    expect(ids).toContain(exam.id);

    // dọn + về chế độ Học sinh → lại 403 như cũ
    await page.request.delete(`/api/exams/${exam.id}`);
    await switchMode("Học sinh");
    const denied = await page.request.post("/api/exams", {
      data: { title: "QA-Nope", subject: "Toán", durationMinutes: 15, questions: [] },
    });
    expect(denied.status()).toBe(403);
  });
});
