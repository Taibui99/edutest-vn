import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";
import { STUDENT, TEACHER, BASE_URL } from "./helpers";

async function loginReq(email: string, password: string): Promise<APIRequestContext> {
  const req = await pwRequest.newContext({ baseURL: BASE_URL });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  const res = await req.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf, email, password },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return req;
}

const Q = [{ type: "mcq", question: "1+1=?", options: ["1", "2", "3", "4"], answer: "B", points: 1 }];

async function createExam(teacher: APIRequestContext, maxAttempts: number) {
  const res = await teacher.post("/api/exams", {
    data: {
      title: `QA-Unlimited-${maxAttempts}-${Date.now()}`,
      subject: "Toán",
      durationMinutes: 15,
      allowGuestAttempts: true,
      maxAttempts,
      showAnswers: true,
      showScoreImmediately: true,
      proctorMode: "off",
      questions: Q,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).exam as { id: string; joinCode: string };
}

async function attemptAndSubmit(student: APIRequestContext, examId: string) {
  const a = await student.post("/api/attempts", { data: { examId } });
  expect(a.status(), await a.text()).toBe(201);
  const attemptId = (await a.json()).id as string;
  const s = await student.post("/api/submissions", { data: { examId, attemptId, answers: {} } });
  expect([200, 201]).toContain(s.status());
}

test.describe("EXAM-1b — số lượt làm bài vô hạn", () => {
  test("maxAttempts=0: làm lại nhiều lần vẫn mở được", async () => {
    const teacher = await loginReq(TEACHER.email, TEACHER.password);
    const student = await loginReq(STUDENT.email, STUDENT.password);
    const exam = await createExam(teacher, 0);
    try {
      for (let i = 0; i < 3; i++) await attemptAndSubmit(student, exam.id);
      const again = await student.post("/api/attempts", { data: { examId: exam.id } });
      expect(again.status(), await again.text()).toBe(201);
    } finally {
      await teacher.delete(`/api/exams/${exam.id}`);
      await teacher.dispose();
      await student.dispose();
    }
  });

  test("maxAttempts=1: chặn ở lượt 2 (không hồi quy)", async () => {
    const teacher = await loginReq(TEACHER.email, TEACHER.password);
    const student = await loginReq(STUDENT.email, STUDENT.password);
    const exam = await createExam(teacher, 1);
    try {
      await attemptAndSubmit(student, exam.id);
      const again = await student.post("/api/attempts", { data: { examId: exam.id } });
      expect(again.status()).toBe(409);
    } finally {
      await teacher.delete(`/api/exams/${exam.id}`);
      await teacher.dispose();
      await student.dispose();
    }
  });
});
