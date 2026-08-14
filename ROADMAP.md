# EduTest VN — Roadmap & Checklist

> File này là nguồn duy nhất để theo dõi tiến độ phát triển.
> Quy tắc: mỗi hạng mục có ô `[ ]`/`[x]`. Sau khi hoàn thành + verify live + push, đánh dấu `[x]`.
> Đừng đánh dấu `[x]` nếu chỉ làm code mà chưa build/verify. Mỗi hạng mục có thể thêm commit hash.

## 🔴 P0 — quan trọng nhất (4 mục mới, đã xong)
- [x] **P0-1 AI Import** — pipeline text→Gemini nhanh, progress theo stage thật, retry + "Chọn file khác" (commit `2287f03` verified live)
- [x] **P0-2 Mobile** — responsive overhaul + test 6 viewport (360/375/390/412/768/1024) 72/72 (commits `56d21ed`, `a41f8bf`)
- [x] **P0-3 Student Runner** — autosave/resume, mark-for-review, timer cảnh báo, confirm nộp (commits `33095f1`, `eff9a83` verified live)
- [x] **P0-4 Exam Configuration** — 4 loại câu, maxAttempts hoạt động thật, trộn câu/đáp án, guest, xem đáp án (commits `d173e79`, `f7f6b9e` verified live)

### P0 cũ (từ HANDOFF) — còn 2 mục
- [ ] **P0-A Fix 404 `/bang-dieu-khien/hoc-sinh`** — tạo trang danh sách học sinh cho teacher (sidebar có link, trang chưa tồn tại)
- [ ] **P0-B Verify `exam-actions.tsx`** — nút Đóng/Mở/Xóa đề (API `PATCH`/`DELETE` + UI có sẵn, chưa test live)

## 🟠 P1 — tính năng chính
- [ ] **P1-1 Results/Analytics nâng cao** — thống kê theo câu hỏi (% đúng), ranking, export CSV/Excel, chi tiết từng học sinh
- [ ] **P1-2 Search/filter danh sách đề** — theo tên/môn/trạng thái
- [ ] **P1-3 Edit đề sau khi tạo** — verify `tao-de-thi?edit` + `PUT /api/exams/[id]` E2E (code có sẵn)
- [ ] **P1-4 Preview student flow** — verify `?preview=1` + nút quay lại quản lý đề
- [ ] **P1-5 Teacher dashboard** — rà soát workflow tạo→publish→theo dõi liền mạch
- [ ] **P1-6 Ngân hàng câu hỏi thật** — CRUD độc lập với exam (hiện placeholder `/ngan-hang`)

## 🟡 P2 — Student features + Admin Panel
- [ ] **P2-1 Student analytics** `/bang-dieu-khien/tien-do` — biểu đồ điểm theo thời gian
- [ ] **P2-2 Streak tracking** — cập nhật `streak` + `lastStudyDate` khi hoạt động
- [ ] **P2-3 Notification đề mới** — khi teacher tạo/giao đề
- [ ] **P2-4 Schedule exam** — thời gian mở/đóng tự động
- [ ] **P2-5 Anti-cheat** — tab detection, fullscreen
- [ ] **P2-6 Forgot password** — quên/đặt lại mật khẩu
- [ ] **P2-7 Flashcard deck / bộ thẻ**
- [ ] **P2-8 Admin Dashboard** — counts (users/teachers/students/exams/submissions) + chart tăng trưởng
- [ ] **P2-9 Admin Users** — search/filter, khóa/mở khóa, đổi role, login history
- [ ] **P2-10 Admin Exams** — xem toàn bộ, ẩn/xóa, moderation
- [ ] **P2-11 Admin Reports** — pending/investigating/resolved/rejected
- [ ] **P2-12 Admin AI Monitoring** — số import, success/error rate, latency, model, timeout
- [ ] **P2-13 Admin System** — health check (DB/API/AI/Storage/Auth) + error logs
- [ ] **P2-14 Admin Settings** — site name, logo, feature flags, maintenance, upload/AI limits
- [ ] **P2-15 Admin Security** — RBAC, admin-only APIs, audit logs, session management
- [ ] **P2-16 Auth/RBAC audit** — role `admin` chưa tồn tại; route + API + ownership

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
