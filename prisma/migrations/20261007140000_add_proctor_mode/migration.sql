-- GĐ3 — Chế độ chống gian lận khi thi (xem ROADMAP mục "Chống gian lận khi thi").
-- Lưu ý: `prisma migrate deploy` chưa bao giờ chạy được trên Vercel vì
-- `0_init/migration.sql` có UTF-8 BOM (xem mục KT-1) — file này là tài liệu
-- cho schema, thực tế áp bằng `prisma db push`.

-- "off" | "light" | "strict". Mặc định "off" để đề cũ không bị siết đột ngột.
ALTER TABLE "Exam" ADD COLUMN "proctorMode" TEXT NOT NULL DEFAULT 'off';