-- GĐ2 — Nhật ký vi phạm + cờ rủi ro (xem ROADMAP mục "Chống gian lận khi thi").
-- Lưu ý: `prisma migrate deploy` chưa bao giờ chạy được trên Vercel vì
-- `0_init/migration.sql` có UTF-8 BOM (xem mục KT-1) — file này là tài liệu
-- cho schema, thực tế áp bằng `prisma db push`.

-- Thêm cờ rủi ro vào Submission (chỉ để giáo viên xem, không trừ điểm).
ALTER TABLE "Submission" ADD COLUMN "violationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Submission" ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Submission" ADD COLUMN "riskLevel" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Submission" ADD COLUMN "autoSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Submission" ADD COLUMN "ipHash" TEXT;

-- Nhật ký vi phạm, gắn với lần làm bài (xoá cascade cùng Attempt).
CREATE TABLE "ProctorEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProctorEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProctorEvent_attemptId_idx" ON "ProctorEvent"("attemptId");
CREATE INDEX "ProctorEvent_type_idx" ON "ProctorEvent"("type");

ALTER TABLE "ProctorEvent" ADD CONSTRAINT "ProctorEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
