// Probe PRODUCTION cho GĐ2 — chứng minh code đã deploy + schema đã db push.
// Chạy: node probe-proctor-prod.mjs   (BASE_URL=https://edutest-vn.vercel.app)
// Tự tạo 1 đề test rồi xoá — không đụng đề có sẵn.
const BASE = process.env.BASE_URL || "https://edutest-vn.vercel.app";
const TEACHER = { email: "tester-gv-20260816@edutest.vn", password: "Test@12345" };
const STUDENT = { email: "tester-hs-20260816@edutest.vn", password: "Test@12345" };

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
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.map.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() { return [...this.map].map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function login(who) {
  const jar = new Jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: jar.header() } });
  jar.absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() },
    body: new URLSearchParams({ csrfToken, email: who.email, password: who.password, json: "true" }),
  });
  jar.absorb(res);
  return jar;
}

async function call(method, path, body, jar) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(jar ? { cookie: jar.header() } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (jar) jar.absorb(res);
  let data = null;
  try { data = await res.json(); } catch { /* không phải json */ }
  return { status: res.status, data };
}

const teacherJar = await login(TEACHER);
const studentJar = await login(STUDENT);
const sess = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: studentJar.header() } }).then((r) => r.json());
check(sess?.user?.role === "student", "dang nhap duoc student tren production", sess?.user?.role ?? "null");
if (!sess?.user) process.exit(1);

/* --- Tạo đề test riêng (5 phút, 5 lượt) --- */
const created = await call("POST", "/api/exams", {
  title: `QA-PROCTOR-${Date.now()}`,
  subject: "Toán",
  durationMinutes: 5,
  maxAttempts: 5,
  status: "published",
  questions: [{ type: "mcq", question: "Câu đo nhật ký vi phạm GĐ2", options: ["a", "b", "c", "d"], answer: "A", points: 1 }],
}, teacherJar);
const examId = created.data?.exam?.id;
check(created.status === 201 && !!examId, "tao duoc de test tren production", `status=${created.status} ${created.data?.error ?? ""}`);
if (!examId) process.exit(1);

const answers = {};
if (created.data?.exam?.questions?.[0]?.id) answers[created.data.exam.questions[0].id] = "A";

async function start() {
  const r = await call("POST", "/api/attempts", { examId }, studentJar);
  return r.status === 201 && r.data?.id ? r.data.id : null;
}
async function submit(id) {
  return call("POST", "/api/submissions", { examId, attemptId: id, answers }, studentJar);
}

const cleanup = async () => {
  const del = await call("DELETE", `/api/exams/${examId}`, null, teacherJar);
  console.log(`${del.status === 200 || del.status === 204 ? "PASS" : "NOTE"}  xoa de test -> ${del.status}`);
};

/* --- 1. Ghi nhật ký + kiểm tra dữ liệu trả về --- */
const t1 = await start();
check(t1 != null, "bat duoc attempt 1", `id=${t1}`);
if (!t1) { await cleanup(); process.exit(1); }

eq((await call("POST", "/api/proctor-events", { attemptId: t1, type: "tab_blur" }, studentJar)).status, 201, "ban tab_blur → 201 (bang ProctorEvent da co)");
eq((await call("POST", "/api/proctor-events", { attemptId: t1, type: "copy" }, studentJar)).status, 201, "ban copy → 201");

eq((await call("POST", "/api/proctor-events", { attemptId: t1, type: "hack_grades" }, studentJar)).status, 400, "type la bi 400");
eq((await call("POST", "/api/proctor-events", { type: "tab_blur" }, studentJar)).status, 400, "thieu attemptId bi 400");
eq((await call("POST", "/api/proctor-events", { attemptId: t1, type: "tab_blur" }, null)).status, 403, "khong co phien bi 403");

/* --- 2. Nộp bài → 5 cột rủi ro phải có trong payload --- */
const s1 = await submit(t1);
eq(s1.status, 200, "nop bai 1 → 200");
const sub1 = s1.data?.submission;
check(sub1 != null, "payload co submission", `keys=${sub1 ? Object.keys(sub1).join(",") : "null"}`);
eq(sub1?.violationCount, 2, "violationCount = 2");
eq(sub1?.riskScore, 45, "riskScore = 45 (tab_blur 15 + copy 30)");
eq(sub1?.riskLevel, "medium", "riskLevel = medium");
eq(sub1?.autoSubmitted, false, "chua dat nguong → autoSubmitted=false");
check(typeof sub1?.ipHash === "string" && sub1.ipHash.length === 16, "co ipHash bam 16 ky tu", `ipHash=${sub1?.ipHash}`);

eq((await call("POST", "/api/proctor-events", { attemptId: t1, type: "tab_blur" }, studentJar)).status, 409, "nop xong → 409");

/* --- 3. Đạt 3 lần → autoSubmitted --- */
const t2 = await start();
check(t2 != null, "bat duoc attempt 2", `id=${t2}`);
for (const type of ["tab_blur", "tab_blur", "visibility_hidden"]) {
  const r = await call("POST", "/api/proctor-events", { attemptId: t2, type }, studentJar);
  if (r.status !== 201) check(false, `ban ${type} that bai`, `status=${r.status}`);
}
const s2 = await submit(t2);
eq(s2.status, 200, "nop bai 2 → 200");
eq(s2.data?.submission?.violationCount, 3, "violationCount = 3");
eq(s2.data?.submission?.riskScore, 70, "riskScore = 70");
eq(s2.data?.submission?.riskLevel, "high", "riskLevel = high");
eq(s2.data?.submission?.autoSubmitted, true, "dat nguong → autoSubmitted=true");

/* --- 4. Bài sạch → none/0 --- */
const t3 = await start();
check(t3 != null, "bat duoc attempt 3", `id=${t3}`);
const s3 = await submit(t3);
eq(s3.status, 200, "nop bai 3 → 200");
eq(s3.data?.submission?.violationCount, 0, "khong vi pham → violationCount=0");
eq(s3.data?.submission?.riskLevel, "none", "khong vi pham → riskLevel=none");
eq(s3.data?.submission?.riskScore, 0, "khong vi pham → riskScore=0");

/* --- 5. Cờ không được làm đổi điểm bài làm --- */
check(typeof sub1?.score === "number" && sub1.score >= 0, "diem bai lam van tinh binh thuong", `score=${sub1?.score} ${sub1?.correctCount}/${sub1?.totalQuestions}`);

/* --- 6. Xoá đề → attempt biến mất (ProctorEvent cascade xoá theo, đã đo local) --- */
await cleanup();
const gone = await call("GET", `/api/attempts/${t1}`, null, studentJar);
check(gone.status === 404, "xoa de thi attempt cung bi xoá", `status=${gone.status}`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
