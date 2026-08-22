const { request } = require("playwright");

async function main() {
  const req = await request.newContext({ baseURL: "https://edutest-vn.vercel.app" });
  const csrf = (await (await req.get("/api/auth/csrf")).json()).csrfToken;
  await req.post("/api/auth/callback/credentials", { form: { csrfToken: csrf, email: "tester-gv-20260816@edutest.vn", password: "Test@12345" } });

  // 1. Xóa exam QA-*
  const exams = (await (await req.get("/api/exams?limit=300")).json()).exams;
  const qaExams = exams.filter(e => /^QA/.test(e.title));
  let delExams = 0;
  for (const e of qaExams) {
    const r = await req.delete(`/api/exams/${e.id}`);
    if (r.status() === 200) delExams++;
    else console.log("  exam fail:", e.id, e.title, r.status());
  }
  console.log(`Deleted exams: ${delExams}/${qaExams.length}`);

  // 2. Xóa lớp QA-*
  const cls = await (await req.get("/api/classrooms")).json();
  const clist = Array.isArray(cls) ? cls : (cls.classrooms || []);
  const qaCls = clist.filter(c => /^QA-/.test(c.name));
  let delCls = 0;
  for (const c of qaCls) {
    const r = await req.delete(`/api/classrooms/${c.id}`);
    if (r.status() === 200) delCls++;
  }
  console.log(`Deleted classes: ${delCls}/${qaCls.length}`);

  // 3. Xóa câu hỏi QA trong ngân hàng
  const bank = await (await req.get("/api/question-bank")).json();
  const items = Array.isArray(bank) ? bank : (bank.items || []);
  const qaItems = items.filter(i => /QA/.test(i.text || ""));
  let delItems = 0;
  for (const it of qaItems) {
    const r = await req.delete(`/api/question-bank/${it.id}`);
    if (r.status() === 200) delItems++;
  }
  console.log(`Deleted bank items: ${delItems}/${qaItems.length}`);

  // 4. Liệt kê user QA rác (admin cần quyền)
  try {
    const adminReq = await request.newContext({ baseURL: "https://edutest-vn.vercel.app" });
    const acsrf = (await (await adminReq.get("/api/auth/csrf")).json()).csrfToken;
    await adminReq.post("/api/auth/callback/credentials", { form: { csrfToken: acsrf, email: "admin-p2@edutest.vn", password: "testpass" } });
    const users = await (await adminReq.get("/api/admin/users?limit=300")).json();
    const ulist = users.users || users;
    const qaUsers = ulist.filter(u => /^QA |^qa-|@qa\.|qa-test|qa-ui|qa-reset|qa-short|qa-confirm|qa-cb|QA Val/.test(`${u.name} ${u.email}`));
    let delUsers = 0;
    for (const u of qaUsers) {
      if (u.id === "cmsvqqtds0000gt04t799hinp") continue; // tester-gv
      const r = await adminReq.delete(`/api/admin/users/${u.id}`).catch(async () => {
        const r2 = await adminReq.delete("/api/admin/users", { data: { id: u.id } });
        return r2;
      });
      if (r.status() === 200 || r.status() === 204) delUsers++;
      else console.log("  user fail:", u.email, r.status());
    }
    console.log(`Deleted QA users: ${delUsers}/${qaUsers.length}`);
    await adminReq.dispose();
  } catch (e) {
    console.log("User cleanup note:", e.message.split("\n")[0]);
  }

  await req.dispose();
}

main().catch(e => { console.error(e); process.exit(1); });