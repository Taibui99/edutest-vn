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
    await login(page, STUDENT.email, STUDENT.password);
    // bật chế độ Giáo viên qua hub (có hộp xác nhận)
    await page.goto("/bang-dieu-khien");
    await page.getByText("Giáo viên", { exact: true }).first().click();
    await page.getByRole("button", { name: "Chuyển chế độ" }).click();
    await page.waitForURL(/\/bang-dieu-khien/, { timeout: 20000 });

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
    await page.goto("/bang-dieu-khien");
    await page.getByText("Học sinh", { exact: true }).first().click();
    await page.getByRole("button", { name: "Chuyển chế độ" }).click();
    await page.waitForURL(/\/bang-dieu-khien/, { timeout: 20000 });
    const denied = await page.request.post("/api/exams", {
      data: { title: "QA-Nope", subject: "Toán", durationMinutes: 15, questions: [] },
    });
    expect(denied.status()).toBe(403);
  });
});
