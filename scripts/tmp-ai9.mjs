/** TEMP AI-9 key verify — xoa sau khi dung. */
import { request } from "@playwright/test";
import { readFileSync } from "node:fs";
const BASE = "https://a6class-edu.vercel.app";
const req = await request.newContext({ baseURL: BASE });
const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
await req.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email: "tester-gv-20260816@edutest.vn", password: "Test@12345" } });
const buf = readFileSync("C:\\Users\\PC\\Downloads\\ĐỀ TEST CHỦ ĐỀ 4-5-6 - ĐÁP ÁN.docx");
const t0 = Date.now();
const r = await req.post("/api/gemini", {
  multipart: { file: { name: "DE-TEST.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: buf }, mode: "smart" },
  timeout: 420000,
});
console.log(`status=${r.status()} after ${((Date.now() - t0) / 1000).toFixed(0)}s`);
const body = await r.text();
const res = body.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((e) => e && e.type === "result");
if (!res) {
  const err = body.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((e) => e && e.type === "error");
  console.log("ERROR:", err?.error); process.exit(1);
}
const qs = JSON.parse(res.result).questions ?? [];
console.log(`vision=${res.meta?.vision ?? 0} provider=${res.meta?.provider} n=${qs.length}`);
const fromDoc = qs.filter((q) => q.answerSource === "document").length;
console.log(`answerSource=document: ${fromDoc}/${qs.length}, needsReview: ${qs.filter((q) => q.needsReview).length}`);
// key doc tu phan dau (10 nhom ro rang): D,D,A,A,B,C,B,D,B,A
const KEY = ["D", "D", "A", "A", "B", "C", "B", "D", "B", "A"];
const mcq = qs.filter((q) => q.type === "mcq").slice(0, 10);
let match = 0;
mcq.forEach((q, i) => {
  const ok = q.answer === KEY[i] ? "OK " : "LECH";
  if (q.answer === KEY[i]) match++;
  console.log(`${ok} Q${i + 1}: model=${q.answer} key=${KEY[i]} src=${q.answerSource} "${String(q.question).slice(0, 50)}"`);
});
console.log(`=> khop key: ${match}/${mcq.length}`);
await req.dispose();