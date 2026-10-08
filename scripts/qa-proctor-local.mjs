// Kiểm chứng GĐ2 — nhật ký vi phạm + cờ rủi ro. Cần server local đang chạy.
// Cách chạy:  node scripts/qa-proctor-local.mjs        (server :3113)
//             BASE_URL=http://localhost:3113 node scripts/qa-proctor-local.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const PROJECT = path.dirname(fileURLToPath(new URL(".", import.meta.url)));
const require = createRequire(path.join(PROJECT, "package.json"));
const { PrismaClient } = require("@prisma/client");

const BASE = process.env.BASE_URL || "http://localhost:3113";
const env = readFileSync(path.join(PROJECT, ".env"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const prisma = new PrismaClient();

const STUDENT = { email: "tester-hs-20260816@edutest.vn", password: "Test@12345" };
const TEACHER = { email: "tester-gv-20260816@edutest.vn", password: "Test@12345" };
const startedAt = new Date();

let failures = 0;
function check(ok, label, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`);
  if (!ok) failures++;
}
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(ok, label, ok ? "" : `thuc te=${JSON.stringify(actual)} mong doi=${JSON.stringify(expected)}`);
}

class Jar {
  constructor() { this.map = new Map(); }
  absorb(res) {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.map.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() { return [...this.map].map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function login(user = STUDENT) {
  const jar = new Jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: jar.header() } });
  jar.absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() },
    body: new URLSearchParams({ csrfToken, email: user.email, password: user.password, json: "true" }),
  });
  jar.absorb(res);
  return jar;
}

async function post(path, body, jar) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jar ? jar.header() : "" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const jar = await login();
const who = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: jar.header() } }).then((r) => r.json());
check(who?.user?.role === "student", "dang nhap duoc tai khoan student", who?.user?.role ?? "null");
if (!who?.user) { await prisma.$disconnect(); process.exit(1); }
const studentId = who.user.id;

const exam = await prisma.exam.findFirst({
  where: { status: "published", deletedAt: null, hidden: false, openAt: null, closeAt: null, maxAttempts: { gte: 3 }, questions: { some: {} } },
  select: { id: true, title: true, durationMinutes: true, maxAttempts: true, questions: { orderBy: { order: "asc" }, select: { id: true, type: true, options: true } } },
  orderBy: { createdAt: "asc" },
});
if (!exam) { console.log("Khong co de thi published nao"); await prisma.$disconnect(); process.exit(1); }

// Dọn vết lần chạy trước
await prisma.submission.deleteMany({ where: { studentId, examId: exam.id } });
await prisma.attempt.deleteMany({ where: { studentId } });

async function startAttempt() {
  const r = await post("/api/attempts", { examId: exam.id }, jar);
  return r.status === 201 && r.data?.id ? r.data.id : null;
}

async function submit(attemptId) {
  const answers = {};
  for (const q of exam.questions) if (q.type === "mcq" && q.options.length) answers[q.id] = "A";
  return post("/api/submissions", { examId: exam.id, attemptId, answers }, jar);
}

/* ---------- 1. Ghi nhật ký ---------- */
const t1 = await startAttempt();
check(t1 != null, "tao duoc attempt lan 1", `id=${t1}`);

const e1 = await post("/api/proctor-events", { attemptId: t1, type: "tab_blur" }, jar);
eq(e1.status, 201, "ban su kien tab_blur → 201");
const e2 = await post("/api/proctor-events", { attemptId: t1, type: "copy" }, jar);
eq(e2.status, 201, "ban su kien copy → 201");

const rows = await prisma.proctorEvent.findMany({ where: { attemptId: t1 }, orderBy: { createdAt: "asc" } });
eq(rows.length, 2, "DB co 2 dong ProctorEvent");
eq(rows.map((r) => r.type), ["tab_blur", "copy"], "luu dung type");
eq(rows[0].severity, "medium", "severity tab_blur do SERVER qui ra = medium");
eq(rows[1].severity, "high", "severity copy do SERVER qui ra = high");

/* ---------- 2. Từ chối dữ liệu không hợp lệ ---------- */
eq((await post("/api/proctor-events", { attemptId: t1, type: "hack_the_grades" }, jar)).status, 400, "type la bi 400");
eq((await post("/api/proctor-events", { type: "tab_blur" }, jar)).status, 400, "thieu attemptId bi 400");
eq((await post("/api/proctor-events", { attemptId: "khong-ton-tai", type: "tab_blur" }, jar)).status, 404, "attempt khong ton tai → 404");
eq((await post("/api/proctor-events", { attemptId: t1, type: "tab_blur" }, null)).status, 403, "khong co phien → 403");

/* ---------- 3. Nộp bài khi có 2 cờ → medium, chưa auto ---------- */
const s1 = await submit(t1);
eq(s1.status, 200, "nop bai lan 1 → 200");
const sub1 = await prisma.submission.findUnique({ where: { attemptId: t1 } });
eq(sub1?.violationCount, 2, "violationCount = 2");
eq(sub1?.riskScore, 45, "riskScore = 45 (tab_blur 15 + copy 30)");
eq(sub1?.riskLevel, "medium", "riskLevel = medium");
eq(sub1?.autoSubmitted, false, "chua dat nguong → autoSubmitted=false");
check(typeof sub1?.ipHash === "string" && sub1.ipHash.length === 16, "co ipHash bam 16 ky tu", `ipHash=${sub1?.ipHash}`);

/* ---------- 4. Sau khi nộp thì không ghi thêm ---------- */
eq((await post("/api/proctor-events", { attemptId: t1, type: "tab_blur" }, jar)).status, 409, "nop xong roi → 409");

/* ---------- 5. Đạt ngưỡng 3 lần → autoSubmitted ---------- */
const t2 = await startAttempt();
check(t2 != null, "tao duoc attempt lan 2", `id=${t2}`);
for (const type of ["tab_blur", "tab_blur", "visibility_hidden"]) {
  const r = await post("/api/proctor-events", { attemptId: t2, type }, jar);
  if (r.status !== 201) check(false, `ban ${type} that bai`, `status=${r.status}`);
}
const s2 = await submit(t2);
eq(s2.status, 200, "nop bai lan 2 → 200");
const sub2 = await prisma.submission.findUnique({ where: { attemptId: t2 } });
eq(sub2?.violationCount, 3, "violationCount = 3");
eq(sub2?.riskScore, 70, "riskScore = 70 (45 + 25 tuong ung autoSubmit)");
eq(sub2?.riskLevel, "high", "riskLevel = high");
eq(sub2?.autoSubmitted, true, "dat nguong → autoSubmitted=true");

/* ---------- 6. Bài sạch → none/0 ---------- */
const t3 = await startAttempt();
check(t3 != null, "tao duoc attempt lan 3", `id=${t3}`);
const s3 = await submit(t3);
eq(s3.status, 200, "nop bai lan 3 → 200");
const sub3 = await prisma.submission.findUnique({ where: { attemptId: t3 } });
eq(sub3?.violationCount, 0, "khong vi pham → violationCount=0");
eq(sub3?.riskLevel, "none", "khong vi pham → riskLevel=none");
eq(sub3?.riskScore, 0, "khong vi pham → riskScore=0");
eq(sub3?.autoSubmitted, false, "khong vi pham → autoSubmitted=false");

/* ---------- 7. Điểm bài làm KHÔNG bị cờ làm đổi ---------- */
check(sub1?.score != null && sub1.score >= 0, "diem bai lam van tinh binh thuong", `score=${sub1?.score} correct=${sub1?.correctCount}/${sub1?.totalQuestions}`);

/* ---------- 8. Xoá attempt thì nhật ký xoá theo ---------- */
await prisma.proctorEvent.deleteMany({ where: { attemptId: t1 } });
const t4 = await startAttempt();
await post("/api/proctor-events", { attemptId: t4, type: "tab_blur" }, jar);
eq(await prisma.proctorEvent.count({ where: { attemptId: t4 } }), 1, "co 1 su kien truoc khi xoa");
await prisma.attempt.deleteMany({ where: { studentId } });
eq(await prisma.proctorEvent.count({ where: { attemptId: t4 } }), 0, "xoa attempt cascade xoa ProctorEvent");

/* ---------- 9. GĐ3 — loại sự kiện mới của rào trình duyệt ---------- */
const t5 = await startAttempt();
check(t5 != null, "tao duoc attempt cho su kien GD3", `id=${t5}`);
for (const [type, sev] of [["print", "high"], ["screen_share", "high"], ["view_source", "medium"], ["screenshot", "medium"]]) {
  const r = await post("/api/proctor-events", { attemptId: t5, type }, jar);
  eq(r.status, 201, `ban su kien ${type} → 201`);
  const row = await prisma.proctorEvent.findFirst({ where: { attemptId: t5, type } });
  eq(row?.severity, sev, `severity ${type} do SERVER qui ra = ${sev}`);
}

/* ---------- 10. GĐ3 — chế độ chống gian lận trên Exam ---------- */
const teacherJar = await login(TEACHER);
const whoT = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: teacherJar.header() } }).then((r) => r.json());
check(["teacher", "admin"].includes(whoT?.user?.role), "dang nhap duoc tai khoan giao vien", whoT?.user?.role ?? "null");

const gd3Question = { type: "mcq", question: "2 + 2 = ?", options: ["1", "2", "3", "4"], answer: "D" };
const examPayload = (over = {}) => ({
  title: `QA-GD3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  subject: "Toán",
  durationMinutes: 5,
  maxAttempts: 1,
  allowGuestAttempts: false,
  questions: [gd3Question],
  ...over,
});
async function createExam(over) {
  const r = await post("/api/exams", examPayload(over), teacherJar);
  return r;
}
async function putExam(id, over) {
  const res = await fetch(`${BASE}/api/exams/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: teacherJar.header() },
    body: JSON.stringify(examPayload(over)),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const cDefault = await createExam(undefined);
eq(cDefault.status, 201, "tao de moi (khong truyen proctorMode) → 201");
eq(cDefault.data?.exam?.proctorMode, "off", "mac dinh proctorMode = off");
const examDefaultId = cDefault.data?.exam?.id;

const cStrict = await createExam({ proctorMode: "strict" });
eq(cStrict.status, 201, "tao de proctorMode=strict → 201");
eq(cStrict.data?.exam?.proctorMode, "strict", "luu dung strict");
const examStrictId = cStrict.data?.exam?.id;

const gStrict = await fetch(`${BASE}/api/exams/${examStrictId}`, { headers: { cookie: teacherJar.header() } }).then((r) => r.json());
eq(gStrict?.exam?.proctorMode, "strict", "GET chi tiet tra proctorMode=strict");

const invalidCreate = await post("/api/exams", examPayload({ proctorMode: "maximum" }), teacherJar);
eq(invalidCreate.status, 400, "proctorMode la khi tao → 400");

const putOk = await fetch(`${BASE}/api/exams/${examStrictId}`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie: teacherJar.header() },
  body: JSON.stringify(examPayload({ proctorMode: "light" })),
});
const putOkData = await putOk.json();
eq(putOk.status, 200, "PUT doi proctorMode=light → 200");
eq(putOkData?.exam?.proctorMode, "light", "PUT luu dung light");

const putBad = await fetch(`${BASE}/api/exams/${examStrictId}`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie: teacherJar.header() },
  body: JSON.stringify(examPayload({ proctorMode: "turbo" })),
});
eq(putBad.status, 400, "PUT proctorMode la → 400");

for (const id of [examDefaultId, examStrictId]) {
  if (!id) continue;
  const d = await fetch(`${BASE}/api/exams/${id}`, { method: "DELETE", headers: { cookie: teacherJar.header() } });
  check(d.status === 200, `xoa de test GD3 → 200`, `id=${id} status=${d.status}`);
}

/* ---------- Dọn ---------- */
await prisma.submission.deleteMany({ where: { studentId, examId: exam.id } });
await prisma.attempt.deleteMany({ where: { studentId } });
await prisma.notification.deleteMany({ where: { link: `/bang-dieu-khien/de-thi/${exam.id}`, createdAt: { gte: startedAt } } });

await prisma.$disconnect();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
