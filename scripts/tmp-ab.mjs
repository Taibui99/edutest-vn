/** TEMP A/B engine — xoa sau khi dung. */
import { request } from "@playwright/test";
const BASE = "https://a6class-edu.vercel.app";
const THEORY = "Ly thuyet so tu nhien: Phep cong: 1+1=2, 2+3=5. Phep nhan: 2x3=6, 5x5=25. So chan la so chia het cho 2 (vi du 4 va 8 la so chan). So le la so chia cho 2 du 1 (vi du 7 va 9 la so le). Tong cac so tu 1 den 4 bang 10.";
const OPTS = { subject: "Toán", count: 5, types: ["mcq"], customNote: "Soan 5 cau trac nghiem, moi cau co dap an dung ro rang tu ly thuyet tren" };
const req = await request.newContext({ baseURL: BASE });
const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
await req.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email: "tester-gv-20260816@edutest.vn", password: "Test@12345" } });
for (const fp of [undefined, "groq"]) {
  const t0 = Date.now();
  try {
    const body = { prompt: THEORY, mode: "generate", options: OPTS, ...(fp ? { forceProvider: fp } : {}) };
    const r = await req.post("/api/gemini", { data: body, timeout: 240000, headers: { "Content-Type": "application/json" } });
    const raw = await r.text();
    const res = raw.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((e) => e && e.type === "result");
    if (!res) { console.log(`--- ${fp || "gemini"}: NO RESULT (status=${r.status()})`, raw.slice(-200)); continue; }
    const qs = JSON.parse(res.result).questions ?? [];
    console.log(`--- ${fp || "gemini"}: ${((Date.now() - t0) / 1000).toFixed(0)}s provider=${res.meta?.provider} n=${qs.length}`);
    qs.forEach((q, i) => console.log(`Q${i + 1}: ${String(q.question).slice(0, 70)} | ans=${q.answer} | opts=${(q.options || []).join("/")}`.slice(0, 140)));
  } catch (e) {
    console.log(`--- ${fp || "gemini"}: ERR ${String(e).split("\n")[0].slice(0, 120)}`);
  }
}
await req.dispose();