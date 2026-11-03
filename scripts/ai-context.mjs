import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const OUT = join(ROOT, "docs", "AI-CONTEXT.md");
const SKIP = new Set(["node_modules", ".next", ".git", ".vercel", "qa-shots", "evidence", "backups", "so-do-tu-duy", "supabase", "mockup", "design-system", "public", ".vscode"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const files = walk(ROOT).map((f) => relative(ROOT, f).replace(/\\/g, "/"));
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const routeOf = (p) =>
  "/" +
  p
    .replace(/^app\//, "")
    .replace(/\/(page|route)\.tsx?$/, "")
    .split("/")
    .filter((s) => s && !/^\(.*\)$/.test(s))
    .join("/");

const pages = files.filter((f) => /^app\/.*page\.tsx$/.test(f)).map(routeOf).sort();
const apiFiles = files.filter((f) => /^app\/api\/.*route\.ts$/.test(f));
const apis = apiFiles
  .map((f) => {
    const src = read(f);
    const methods = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((m) => m[1]);
    return { route: routeOf(f), methods: [...new Set(methods)].sort(), file: f };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const libFiles = files.filter((f) => /^lib\/[^/]+\.ts$/.test(f)).sort();
const libSymbols = libFiles.map((f) => {
  const src = read(f);
  const syms = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  return { file: f, lines: src.split("\n").length, syms: [...new Set(syms)] };
});

const modelSrc = read("prisma/schema.prisma");
const models = [...modelSrc.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)].map((m) => {
  const fields = m[2]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@") && !l.startsWith("@"))
    .map((l) => {
      const [name, type] = l.split(/\s+/);
      return type ? `${name}:${type}` : name;
    });
  return { name: m[1], fields };
});

const specs = files.filter((f) => /^tests\/e2e\/.*\.spec\.ts$/.test(f)).sort();
const specInfo = specs.map((f) => {
  const src = read(f);
  const tests = [...src.matchAll(/\btest\s*\(/g)].length;
  return { file: f.replace("tests/e2e/", ""), tests };
});

const qa = files.filter((f) => /^scripts\/qa-.*\.mjs$/.test(f)).map((f) => f.replace("scripts/", "")).sort();

const pkg = JSON.parse(read("package.json"));
const deps = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
  .map(([n, v]) => `${n}@${v}`)
  .sort();

const commits = execFileSync("git", ["log", "-30", "--format=%h|%ad|%s", "--date=short"], { cwd: ROOT, encoding: "utf8" })
  .trim()
  .split("\n")
  .map((l) => {
    const [h, d, s] = l.split("|");
    return `- \`${h}\` ${d} — ${s}`;
  });

const roadmap = read("ROADMAP.md");

const L = [];
const p = (s = "") => L.push(s);

p("# A6Class Edu — Gói ngữ cảnh đầy đủ cho AI");
p();
p("> Tài liệu này được tạo tự động để nạp vào ChatGPT/Claude làm ngữ cảnh dự án.");
p("> Nguồn: mã nguồn trong `D:\\edutest-vn` (branch `main`). Tạo lại bằng `node scripts/ai-context.mjs`.");
p("> Khi trả lời, hãy dựa vào tài liệu này; nếu thiếu chi tiết file cụ thể, hãy yêu cầu người dùng dán file đó thay vì đoán.");
p();
p("## 1. Sản phẩm là gì");
p();
p("**A6Class Edu** (tên cũ EduTest VN) — hệ thống thi trực tuyến cho giáo viên Việt Nam, thiết kế cho một lớp học (~40 học sinh) nhưng chạy được production.");
p("Giáo viên soạn đề (tay, AI, hoặc đọc từ file Word/PDF), giao cho lớp hoặc phát mã cho khách, học sinh làm bài trên web (kể cả máy cũ), hệ thống tự chấm và trả kết quả/thống kê.");
p("Điểm mạnh riêng: **bộ đọc đề Word/PDF thuần rule** — nhận đúng cấu trúc đề Việt Nam (Câu 1..N, A/B/C/D, mệnh đề a–d, bảng đáp án, công thức OMML/MathType), đáp án tô màu/highlight/gạch chân, bảng số liệu thành bảng thật; hiển thị công thức bằng KaTeX render sẵn HTML (không cần JS trên máy học sinh cũ).");
p();
p("## 2. Vị trí & hạ tầng");
p();
p("- Mã nguồn local: `D:\\edutest-vn` (Windows). Không nằm trong thư mục `Default Project`.");
p("- GitHub: https://github.com/Taibui99/edutest-vn — nhánh `main`, auto-deploy.");
p("- Production: https://a6class-edu.vercel.app (Vercel, region mặc định).");
p("- Database: PostgreSQL trên Supabase qua Prisma (`DATABASE_URL` pooler + `DIRECT_URL`).");
p("- Lưu trữ ảnh/avatar: Supabase Storage.");
p("- Email: Resend. AI: Google Gemini (chính) + Groq (dự phòng).");
p("- Biến môi trường (chỉ tên, KHÔNG có giá trị): `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `EXAM_IMPORT_MODEL`, `GROQ_MODEL`, `EMAIL_FROM`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PROCTOR_IP_SALT`.");
p();
p("## 3. Công nghệ");
p();
p("- Next.js App Router (React 19, TypeScript), Tailwind CSS v4, Prisma 6, PostgreSQL (Supabase).");
p("- KaTeX render server-side (HTML + MathML), không dùng MathJax client.");
p("- `@google/genai` + `@google/generative-ai` (Gemini), Groq qua REST; `mammoth`/`adm-zip`/tự viết XML parser cho DOCX; `cfb` cho OLE/MathType.");
p("- bcryptjs + session cookie ký HMAC; admin/teacher/student/guest.");
p("- Kiểm thử: script QA thuần Node (`scripts/qa-*.mjs`) + Playwright E2E (`tests/e2e`).");
p();
p("## 4. Vai trò & quyền");
p();
p("- **Khách (guest)**: vào bằng mã đề + tên/lớp, không cần tài khoản (nếu GV bật). Mỗi cookie một phiên; xem điểm sau nộp.");
p("- **Học sinh**: tài khoản; lớp học, làm bài được giao, tiến độ/streak, flashcard, thông báo, xem kết quả.");
p("- **Giáo viên**: tạo/sửa/nhân bản đề, 4 loại câu, ngân hàng câu hỏi, lớp học & giao đề, chấm, thống kê, bảng điểm trực tiếp.");
p("- **Admin**: toàn bộ + quản trị người dùng/đề/báo cáo/audit/AI/system/settings, maintenance mode.");
p();
p("## 5. Tính năng đã có (theo module)");
p();
p("### Đề thi & soạn đề");
p("- 4 loại câu: `mcq` (1 đáp án đúng), `true_false` (4 mệnh đề a–d, chấm điểm từng mệnh đề), `short_answer` (so khớp đáp án + `acceptedAnswers`), `essay` (chấm tay).");
p("- Trộn câu/đáp án, giới hạn số lượt, hẹn giờ mở/đóng, ẩn đề, xem trước dưới góc học sinh, nhân bản đề, sửa đề sau khi tạo.");
p("- Chèn ảnh minh hoạ vào câu hỏi; ngân hàng câu hỏi dùng lại.");
p("- Nhập đề: dán text, tải DOCX/PDF (text), AI dựng đề theo yêu cầu; đọc đề bằng rule (không tốn AI) hoặc AI bổ trợ.");
p("- Bộ đọc DOCX: numbering tự động của Word, công thức OMML → LaTeX, MathType OLE (MTEF v5) → LaTeX, đáp án tô màu đỏ, highlight vàng, gạch chân mệnh đề, bảng số liệu → bảng Markdown/HTML thật, tách tiêu đề phần I/II/III/IV, bỏ watermark.");
p("- Chấm: thang 10; trắc nghiệm đúng/sai; đúng/sai tính điểm riêng từng mệnh đề; trả lời ngắn chuẩn hoá chuỗi; tự luận chấm tay; công thức điểm `10 − điểm mất`.");
p();
p("### Thi & chống gian lận");
p("- Runner có autosave/resume (localStorage + server), đánh dấu xem lại, đồng hồ cảnh báo, xác nhận nộp, mất mạng có cảnh báo.");
p("- Chế độ nghiêm: bắt buộc fullscreen, phát hiện chuyển tab, khoá phím tắt/in, ghi `ProctorEvent`, 3 vi phạm → cảnh báo + tự nộp.");
p("- Đáp án đúng không gửi xuống client khi đề đang mở; bảng điểm trực tiếp chỉ lộ key khi được phép.");
p("- Bản `/thi-cu/[code]` là HTML thuần cho iOS 15/máy cũ (không JS), tự mở/đóng theo lịch.");
p();
p("### Kết quả & quản lý lớp");
p("- Kết quả học sinh: điểm, đáp án đúng, giải thích, làm lại (nếu cho phép).");
p("- GV: danh sách bài nộp tự làm mới, lọc/tìm, bảng điểm trực tiếp chiếu tivi, bấm tên xem chi tiết bài làm, xuất CSV UTF-8 BOM, thống kê % đúng từng câu, xếp hạng.");
p("- Lớp học: tạo lớp, thành viên, giao đề cho lớp, thông báo đề mới.");
p("- HS: trang tiến độ (biểu đồ điểm theo thời gian), streak, flashcard, thông báo.");
p();
p("### Admin & vận hành");
p("- Dashboard + analytics, users (khoá/mở, đổi role, lịch sử đăng nhập), exams (ẩn/xoá/khôi phục), reports, audit log, AI monitoring (số import, tỉ lệ lỗi, latency, model), system health, settings (feature flag, maintenance, giới hạn upload/AI).");
p("- Soft delete cho User/Exam/Report; maintenance mode admin bypass; RBAC kiểm tra ở server cho mọi API admin.");
p("- Log lỗi `AppLog`, health check `/api/health`.");
p();
p("## 6. Mô hình dữ liệu (Prisma)");
p();
for (const m of models) p(`- **${m.name}** — ${m.fields.join(", ")}`);
p();
p("## 7. Trang (App Router)");
p();
for (const r of pages) p(`- \`${r}\``);
p();
p("## 8. API");
p();
for (const a of apis) p(`- ${a.methods.length ? a.methods.join("/") : "(handler)"} \`${a.route}\``);
p();
p("## 9. Thư viện lõi");
p();
for (const l of libSymbols) p(`- \`${l.file}\` (${l.lines} dòng) — ${l.syms.slice(0, 14).join(", ")}${l.syms.length > 14 ? ", …" : ""}`);
p();
p("## 10. Kiểm thử");
p();
p("Script QA thuần Node (chạy `node scripts/qa-*.mjs`): " + qa.join(", ") + ".");
p();
p("Playwright E2E (`tests/e2e`):");
for (const s of specInfo) p(`- \`${s.file}\` — ${s.tests} test`);
p();
p("## 11. Quy ước khi sửa code");
p();
p("- TypeScript strict, **không dùng `any`** (eslint `no-explicit-any` = error).");
p("- Trước khi xong: `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js <files>`, `node node_modules/next/dist/bin/next build`.");
p("- Commit message dạng `type(scope): mo ta khong dau`, commit code và docs riêng; không amend/force-push; chỉ commit khi được yêu cầu.");
p("- Không thêm `loading.tsx` (phá E2E), không set TZ toàn cục, không streaming ở trang thi.");
p("- UI tiếng Việt, thuật ngữ thống nhất (đề thi, bài nộp, học sinh, giáo viên).");
p("- Mọi API kiểm tra quyền + ownership ở server; không tin dữ liệu client.");
p();
p("## 12. Trạng thái hiện tại");
p();
p("- HEAD `bb495bc` (2026-11-02), ~465 commit từ 2026-06-27.");
p("- PARSE-8 hoàn tất và đã deploy: đọc file `De_Dia_li_12_dap_an_sap_xep.docx` ra 88 câu (71 mcq, 5 true_false, 9 short_answer, 3 essay), 4 bảng số liệu, judge 0 phát hiện.");
p("- Đề đã tạo trong nick GV test: \"Địa lí 12 – Đề luyện tập (đọc từ Word)\", mã `76XQRV`, 88 câu, 90 phút, đã xuất bản.");
p("- QA xanh: exam-parse 21/21, latex 14/14, mtef 12/12, omml 8/8, pdf-layout 4/4, ai-judge 6/6, ai-build 16/16; tsc/eslint/build sạch.");
p();
p("### Việc còn treo / giới hạn đã biết");
p("- Cold start production ~14s khi không có truy cập → cần cron ping `/api/health`.");
p("- Chưa đổi `DATABASE_URL` sang pooler cổng `:6543` (đang dùng direct, dễ cạn kết nối khi đông).");
p("- Chưa verify trên máy iOS 15 thật; trang `/thi-cu` (HTML thuần) chưa render LaTeX/bảng.");
p("- 4 hạng mục proctor nâng cao còn chờ (phương án A).");
p("- PARSE-1e: bảng PDF từ toạ độ X, lưu ảnh thật trong câu hỏi (schema chưa có field ảnh).");
p("- File đề Địa lí gốc thiếu đáp án 6 câu trả lời ngắn (Câu 4–9 phần III), thiếu Câu 1–2/17/19/29; khi tạo đề đã tạm chuyển 6 câu đó sang tự luận chấm tay.");
p("- `prisma/migrations/0_init` có BOM nên `migrate deploy` luôn fallback `db push`; chưa re-baseline (có chủ đích).");
p();
p("## 13. Commit gần đây");
p();
for (const c of commits) p(c);
p();
p("## 14. ROADMAP đầy đủ (lịch sử chi tiết từng hạng mục + commit hash)");
p();
p(roadmap);

mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(OUT, L.join("\n"), "utf8");
console.log("wrote", OUT, L.length, "lines,", Buffer.byteLength(L.join("\n"), "utf8"), "bytes");
console.log("pages", pages.length, "apis", apis.length, "models", models.length, "libs", libFiles.length, "specs", specs.length, "qa", qa.length);
