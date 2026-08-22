import { test, expect, request as pwRequest } from "@playwright/test";
import { TEACHER, STUDENT, login, timestamp } from "./helpers";

async function setupClassroom() {
  const req = await pwRequest.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email: TEACHER.email, password: TEACHER.password },
  });
  const res = await req.post("/api/classrooms", { data: { name: `QA-Lop-${Date.now()}` } });
  const classroom = (await res.json());
  // student join
  const req2 = await pwRequest.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf2 = (await (await req2.get("/api/auth/csrf")).json()).csrfToken;
  await req2.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf2, email: STUDENT.email, password: STUDENT.password },
  });
  await req2.post("/api/classrooms/join", { data: { code: classroom.joinCode } });
  await req.dispose();
  await req2.dispose();
  return classroom;
}

let CLASS = null as any;

test.beforeAll(async () => {
  CLASS = await setupClassroom();
});

test.describe("CLASSROOM — Lớp học", () => {
  test("C-01: Trang lớp học hiển thị + nút tạo/tham gia", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/lop-hoc");
    await expect(page.getByText("Lớp học").filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /tạo lớp mới/i })).toBeVisible();
  });

  test("C-02: Modal tạo lớp — validation tên trống", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto("/bang-dieu-khien/lop-hoc");
    await page.getByRole("button", { name: /tạo lớp mới/i }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /tạo lớp/i }).last().click();
    await expect(page.getByText(/nhập tên lớp/i)).toBeVisible({ timeout: 5000 });
  });

  test("C-03: Chi tiết lớp — tabs Học sinh/Đề thi", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto(`/bang-dieu-khien/lop-hoc/${CLASS.id}`);
    await expect(page.getByText(new RegExp(CLASS.name, "i")).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /học sinh/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /đề thi/i }).first()).toBeVisible();
    await expect(page.getByText(/tester hs/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("C-04: Giao đề thi trong tab Đề thi", async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password);
    await page.goto(`/bang-dieu-khien/lop-hoc/${CLASS.id}`);
    await page.getByRole("button", { name: /đề thi/i }).first().click();
    await expect(page.getByText(/giao đề thi|chọn đề/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("C-05: Student xem lớp đã join", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/lop-hoc");
    await expect(page.getByText(new RegExp(CLASS.name, "i")).first()).toBeVisible({ timeout: 20000 });
  });

test("C-06: Modal tham gia lớp — mã sai báo lỗi", async ({ page }) => {
    await login(page, STUDENT.email, STUDENT.password);
    await page.goto("/bang-dieu-khien/lop-hoc");
    await page.getByRole("button", { name: /tham gia lớp/i }).click();
    await page.locator("#mã-lớp").fill("XXXX99");
    await page.getByRole("button", { name: /tham gia/i }).last().click();
    await expect(page.getByText(/không tìm thấy|không tồn tại|không hợp lệ/i).first()).toBeVisible({ timeout: 10000 });
  });
});
