-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "attemptId" TEXT;

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT,
    "guestParticipantId" TEXT,
    "seed" INTEGER NOT NULL,
    "questionOrder" JSONB NOT NULL,
    "optionOrder" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_guestParticipantId_key" ON "Attempt"("guestParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_activeKey_key" ON "Attempt"("activeKey");

-- CreateIndex
CREATE INDEX "Attempt_examId_studentId_idx" ON "Attempt"("examId", "studentId");

-- CreateIndex
CREATE INDEX "Attempt_examId_idx" ON "Attempt"("examId");

-- CreateIndex
CREATE INDEX "Attempt_activeKey_idx" ON "Attempt"("activeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_attemptId_key" ON "Submission"("attemptId");

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_guestParticipantId_fkey" FOREIGN KEY ("guestParticipantId") REFERENCES "GuestParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

