-- GRADE-1 — Điểm giáo viên chấm tay cho câu tự luận (xem ROADMAP mục
-- "🔥 Thi thật cả lớp" / GRADE-1).
-- Lưu ý: như các migration trước, `prisma migrate deploy` chưa từng chạy được
-- trên Vercel vì `0_init/migration.sql` có UTF-8 BOM — file này là tài liệu cho
-- schema, thực tế được áp bằng `prisma db push` trong script build.
--
-- Dạng JSONB: { "<questionId>": <điểm> } cho các câu tự luận đã chấm.
-- Điểm tổng được tính lại bằng `scoreSubmission` (có trọng số `points` từng câu).
ALTER TABLE "Submission" ADD COLUMN "manualScores" JSONB;
