# EduTest VN — Roadmap & Checklist

> File này là nguồn duy nhất để theo dõi tiến độ phát triển.
> Quy tắc: mỗi hạng mục có ô `[ ]`/`[x]`. Sau khi hoàn thành + verify live + push, đánh dấu `[x]`.
> Đừng đánh dấu `[x]` nếu chỉ làm code mà chưa build/verify. Mỗi hạng mục có thể thêm commit hash.

## 🔴 P0 — quan trọng nhất (4 mục mới, đã xong)
- [x] **P0-1 AI Import** — pipeline text→Gemini nhanh, progress theo stage thật, retry + "Chọn file khác" (commit `2287f03` verified live)
- [x] **P0-2 Mobile** — responsive overhaul + test 6 viewport (360/375/390/412/768/1024) 72/72 (commits `56d21ed`, `a41f8bf`)
- [x] **P0-3 Student Runner** — autosave/resume, mark-for-review, timer cảnh báo, confirm nộp (commits `33095f1`, `eff9a83` verified live)
- [x] **P0-4 Exam Configuration** — 4 loại câu, maxAttempts hoạt động thật, trộn câu/đáp án, guest, xem đáp án (commits `d173e79`, `f7f6b9e` verified live)

### P0 cũ (từ HANDOFF) — đã xong
- [x] **P0-A Fix 404 `/bang-dieu-khien/hoc-sinh`** — trang danh sách học sinh cho teacher: search, filter "Có bài nộp", thống kê (commit `14f1283` verified live)
- [x] **P0-B Verify `exam-actions.tsx`** — Đóng→"Mở lại"+badge "Đã đóng", Mở→"Đóng đề"+badge "Đang mở", Xóa đề thật (verified live, không cần sửa code)

## 🟠 P1 — tính năng chính (đã xong)
- [x] **P1-1 Results/Analytics nâng cao** — % đúng theo câu + phân tích câu hỏi, ranking + 🥇🥈🥉, export CSV (UTF-8 BOM), chi tiết đáp án từng học sinh (commit `85df926` verified live)
- [x] **P1-2 Search/filter danh sách đề** — theo tên (`q`), môn, trạng thái (commit `85df926` verified live)
- [x] **P1-3 Edit đề sau khi tạo** — `tao-de-thi?edit` load + `PUT /api/exams/[id]` E2E (đổi tên đề → persist + redirect) (verified live)
- [x] **P1-4 Preview student flow** — `?preview=1` banner "chế độ xem trước", không nộp được, nút "Quay lại" → trang quản lý đề (verified live)
- [x] **P1-5 Teacher dashboard** — rà soát workflow tạo→publish→theo dõi: greeting, stats, "Cần chú ý", quick actions (verified live)
- [x] **P1-6 Ngân hàng câu hỏi thật** — model `QuestionBankItem` + CRUD `/api/question-bank` + UI 2 tab (kho riêng / trong đề) với modal thêm/sửa/xóa (commit `85df926` verified live)
- [x] **Bonus fix true_false grading** — client gửi `{"0":true}` nhưng route chấm đọc `.statements` → không bao giờ đúng; gộp `lib/grading.ts` chấm cả 2 format (verified live: TF đúng → 10/10)

## 🟡 P2 — Student features + Admin Panel (đã xong)
> Admin Panel spec (#1–#20) đã implement theo yêu cầu: `/admin` route/layout/permission riêng, RBAC server-side, dashboard + `/admin/analytics`, users/exams/reports/audit/settings/system, soft delete (User/Exam/Report), maintenance mode (admin bypass), search/pagination server-side, responsive — commit `e2fcf4b` verified live (admin/teacher/student/guest + API trực tiếp).
- [x] **P2-1 Student analytics** `/bang-dieu-khien/tien-do` — biểu đồ điểm theo thời gian (commit `dba6760` verified live)
- [x] **P2-2 Streak tracking** — cập nhật `streak` + `lastStudyDate` khi hoạt động (commit `dba6760`)
- [x] **P2-3 Notification đề mới** — khi teacher tạo/giao đề (commit `dba6760`)
- [x] **P2-4 Schedule exam** — thời gian mở/đóng tự động (commit `dba6760`; editor "Lịch mở / đóng đề" verified live)
- [x] **P2-5 Anti-cheat** — tab detection, fullscreen (commit `dba6760`; 3 vi phạm → cảnh báo + auto-submit verified live)
- [x] **P2-6 Forgot password** — quên/đặt lại mật khẩu (commit `dba6760`)
- [x] **P2-7 Flashcard deck / bộ thẻ** (commit `dba6760` verified live)
- [x] **P2-8 Admin Dashboard** — counts (users/teachers/students/exams/submissions) + chart tăng trưởng (commits `dba6760`, `e2fcf4b` — thêm aiByStatus/aiErrors/reportsByStatus/topExams/subjects + `/admin/analytics`)
- [x] **P2-9 Admin Users** — search/filter, khóa/mở khóa, đổi role, login history (commit `e2fcf4b` — q/role/status/page, restore, xóa kèm nhập DELETE)
- [x] **P2-10 Admin Exams** — xem toàn bộ, ẩn/xóa, moderation (commit `e2fcf4b` — hide/unhide/restore, soft delete, badge report)
- [x] **P2-11 Admin Reports** — pending/investigating/resolved/rejected (commit `e2fcf4b` — pending/reviewing/resolved/rejected + resolution + handledBy/handledAt)
- [x] **P2-12 Admin AI Monitoring** — số import, success/error rate, latency, model, timeout (commits `dba6760`, `e2fcf4b` — thêm aiErrors)
- [x] **P2-13 Admin System** — health check (DB/API/AI/Storage/Auth) + error logs (commit `e2fcf4b` — 5 checks + lastAiImport)
- [x] **P2-14 Admin Settings** — site name, logo, feature flags, maintenance, upload/AI limits (commit `e2fcf4b` — tabs General/Authentication/Exams/AI/Maintenance, `allowRegistration`/`enableAiImport` thật)
- [x] **P2-15 Admin Security** — RBAC, admin-only APIs, audit logs, session management (commits `dba6760`, `e2fcf4b` — audit search + pagination; mọi API admin chặn teacher/student 403 verified)
- [x] **P2-16 Auth/RBAC audit** — role `admin` chưa tồn tại; route + API + ownership (commit `dba6760`; E1 RBAC guest/teacher/student `/admin` → 307 + API 403 verified live)

## 🟢 P3 — polish & hardening
- [ ] **P3-1 Animation system** — subtle/playful/smooth + hover + `prefers-reduced-motion`
- [ ] **P3-2 Landing polish** — + redirect người đã đăng nhập → dashboard (hiện chưa có)
- [ ] **P3-3 Avatar upload** (Supabase Storage)
- [ ] **P3-4 Edit flashcard** — hiện chỉ tạo/xóa
- [ ] **P3-5 AI generate flashcard**
- [ ] **P3-6 Performance** — bundle, lazy load, Prisma indexes, AI retry/fallback/model
- [ ] **P3-7 Accessibility**
- [ ] **P3-8 Production hardening** — error boundary, logging, monitoring

## 📌 Mục nhỏ trong roadmap
- [ ] **Nhỏ-1 Cảnh báo mất mạng** trong runner (`navigator.onLine`)
- [ ] **Nhỏ-2 Setting "Hiển thị điểm ngay sau khi nộp"** — thêm field + tôn trọng khi hiện kết quả

## ⚙️ Kỹ thuật
- [ ] **KT-1 Chuyển `prisma db push --accept-data-loss` → `migrate deploy`** — giảm rủi ro production
- [ ] **KT-2 Dọn test data** — guest "Test Guest"/"12A1" trên YN5GQZ + tài khoản `testrunner-1786689480719@edutest.vn`

## ✅ Đã xong (không cần làm lại)
- Share/QR (§8, §14) — `chia-se-de/[joinCode]`: copy link, mã truy cập, QR + tải QR, native share
- Re-import / tạo lại đề trong modal import — nút "Thử lại"/"Chọn file khác"
- Streak đọc trong AI coach (chỉ đọc, chưa ghi — đã nằm P2-2)
