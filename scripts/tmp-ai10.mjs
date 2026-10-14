/** TEMP AI-10 coverage verify — xoa sau khi dung. */
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
  console.log("PIPELINE ERROR:", err?.error); process.exit(1);
}
const qs = JSON.parse(res.result).questions ?? [];
const KEY = ["D", "D", "A", "A", "B", "C", "B", "D", "B", "A"];
console.log(`n=${qs.length} blocks=${JSON.stringify(res.meta?.blocks)} fromDoc=${qs.filter((q) => q.answerSource === "document").length} flagged=${qs.filter((q) => q.needsReview).length}`);
let ok = 0, total = 0;
qs.filter((q) => q.type === "mcq").slice(0, 12).forEach((q, i) => {
  if (i >= KEY.length) return;
  total++;
  const good = q.answer === KEY[i];
  if (good) ok++;
  console.log(`${good ? "OK " : (q.needsReview ? "FLAG" : "LECH")} Q${i + 1}: model=${q.answer} key=${KEY[i]} src=${q.answerSource}`);
});
console.log(`=> OK ${ok}/${total}`);
await req.dispose();