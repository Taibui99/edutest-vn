/**
 * QA chịu tải: N client (mặc định 40) thi cùng lúc.
 *
 * Chạy: node scripts/qa-load-40.mjs [baseUrl] [--clients=40]
 *  - API-level (không tốn browser, không tốn quota LLM).
 *  - 40 guest khác nhau (mỗi context 1 cookie jar): join → burst attempts →
 *    rải proctor events → burst submits (giả lập hết giờ nộp cùng lúc).
 *  - Đo phân bố status (đếm 429/500 + message) và p50/p95 từng pha.
 *  - Tự dọn: xóa đề probe (cascade attempts/submissions/events).
 */
import { request } from "@playwright/test";

const BASE = process.argv[2]?.startsWith("http") ? process.argv[2] : "https://a6class-edu.vercel.app";
const N = Number((process.argv.find((a) => a.startsWith("--clients=")) || "").split("=")[1] || 40);
const TEACHER = { email: "tester-gv-20260816@edutest.vn", password: "Test@12345" };

const stats = [];
const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};
const tally = (rows) => {
  const m = {};
  for (const r of rows) {
    const k = `${r.status}${r.note ? ` (${r.note})` : ""}`;
    m[k] = (m[k] || 0) + 1;
  }
  return m;
};

// ── setup: đề probe ──
const admin = await request.newContext({ baseURL: BASE });
{
  const csrf = (await (await admin.get("/api/auth/csrf")).json()).csrfToken;
  await admin.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, ...TEACHER } });
}
const examBody = {
  title: `QA-LOAD-${Date.now()}`,
  subject: "Toán",
  durationMinutes: 60,
  maxAttempts: 5,
  allowGuestAttempts: true,
  status: "published",
  questions: Array.from({ length: 5 }, (_, i) => ({
    type: "mcq", question: `QA load ${i + 1}: 1+1?`, options: ["1", "2", "3", "4"], answer: "B",
  })),
};
const mk = await admin.post("/api/exams", { data: examBody });
if (mk.status() !== 201) {
  console.log("FAIL  setup exam:", mk.status(), (await mk.text()).slice(0, 200));
  process.exit(1);
}
const { exam } = await mk.json();
console.log(`setup: exam ${exam.id} code=${exam.joinCode} clients=${N}`);

// ── 40 guest join (tuần tự, nhẹ) ──
const guests = [];
for (let i = 0; i < N; i++) {
  const ctx = await request.newContext({ baseURL: BASE });
  const r = await ctx.post("/api/guest-attempts", {
    data: { examCode: exam.joinCode, name: `Load ${i}`, className: "12A-LOAD" },
  });
  if (r.status() !== 201) {
    console.log(`FAIL  guest join #${i}:`, r.status(), (await r.text()).slice(0, 150));
    process.exit(1);
  }
  guests.push(ctx);
}
console.log(`join: ${guests.length}/${N} ok`);

// ── burst attempts ──
let t0 = Date.now();
const attRes = await Promise.all(guests.map(async (ctx, i) => {
  const t = Date.now();
  try {
    const r = await ctx.post("/api/attempts", { data: { examId: exam.id }, timeout: 60000 });
    let note = "";
    if (r.status() !== 201) {
      try { note = (await r.json()).error || ""; } catch {}
    }
    const id = r.status() === 201 ? (await r.json()).id : null;
    return { i, status: r.status(), ms: Date.now() - t, note: String(note).slice(0, 60), id };
  } catch (e) {
    return { i, status: "ERR", ms: Date.now() - t, note: String(e).split("\n")[0].slice(0, 60), id: null };
  }
}));
console.log(`attempts burst: ${Date.now() - t0}ms total —`, JSON.stringify(tally(attRes)));
console.log(`  latency p50=${pct(attRes.map((r) => r.ms), 50)}ms p95=${pct(attRes.map((r) => r.ms), 95)}ms`);
const okAtt = attRes.filter((r) => r.status === 201);

// ── rải proctor events (10 client × 2) ──
t0 = Date.now();
const evRes = await Promise.all(okAtt.slice(0, 10).flatMap((a) => ["tab_blur", "copy"].map(async (type) => {
  const t = Date.now();
  try {
    const r = await guests[a.i].post("/api/proctor-events", { data: { attemptId: a.id, type }, timeout: 60000 });
    return { status: r.status(), ms: Date.now() - t };
  } catch (e) {
    return { status: "ERR", ms: Date.now() - t };
  }
})));
console.log(`proctor 20 calls: ${Date.now() - t0}ms —`, JSON.stringify(tally(evRes)));

// ── burst submits (giả lập hết giờ) ──
const detail = await (await admin.get(`/api/exams/${exam.id}`)).json().catch(() => ({}));
const answers = {};
for (const q of (detail.exam?.questions ?? exam.questions ?? [])) answers[q.id] = "B";
t0 = Date.now();
const subRes = await Promise.all(okAtt.map(async (a) => {
  const t = Date.now();
  try {
    const r = await guests[a.i].post("/api/submissions", { data: { examId: exam.id, attemptId: a.id, answers }, timeout: 90000 });
    let note = "";
    if (r.status() !== 200) {
      try { note = (await r.json()).error || ""; } catch {}
    }
    return { status: r.status(), ms: Date.now() - t, note: String(note).slice(0, 60) };
  } catch (e) {
    return { status: "ERR", ms: Date.now() - t, note: String(e).split("\n")[0].slice(0, 60) };
  }
}));
console.log(`submits burst: ${Date.now() - t0}ms total —`, JSON.stringify(tally(subRes)));
console.log(`  latency p50=${pct(subRes.map((r) => r.ms), 50)}ms p95=${pct(subRes.map((r) => r.ms), 95)}ms`);

// ── cleanup ──
for (const g of guests) await g.dispose();
const delRes = await admin.delete(`/api/exams/${exam.id}`);
console.log("cleanup delete exam:", delRes.status());
const gone = await admin.get(`/api/exams/${exam.id}`);
console.log("exam gone (404):", gone.status() === 404);
await admin.dispose();

const bad = [...attRes, ...subRes].filter((r) => r.status !== 201 && r.status !== 200);
console.log(`\nKET QUA: attempts ok=${okAtt.length}/${N}, submits ok=${subRes.filter((r) => r.status === 200).length}/${okAtt.length}`);
if (bad.length) {
  console.log("cac loi that bai:");
  for (const b of bad.slice(0, 10)) console.log("  -", JSON.stringify(b));
  process.exit(1);
}
console.log("ALL GREEN");
