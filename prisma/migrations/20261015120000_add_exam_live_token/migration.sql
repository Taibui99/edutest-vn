-- LIVE-1: token bí mật cho bảng điểm trực tiếp (link không cần đăng nhập).
ALTER TABLE "Exam" ADD COLUMN "liveToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Exam_liveToken_key" ON "Exam"("liveToken");
