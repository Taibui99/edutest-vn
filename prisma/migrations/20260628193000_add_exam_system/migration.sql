CREATE TABLE "Exam" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "joinCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'published',
  "teacherId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "options" TEXT[],
  "answer" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Submission" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "answers" JSONB NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "correctCount" INTEGER NOT NULL,
  "totalQuestions" INTEGER NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Exam_joinCode_key" ON "Exam"("joinCode");
CREATE INDEX "Exam_teacherId_idx" ON "Exam"("teacherId");
CREATE INDEX "Exam_joinCode_idx" ON "Exam"("joinCode");
CREATE INDEX "Question_examId_idx" ON "Question"("examId");
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");
CREATE UNIQUE INDEX "Submission_examId_studentId_key" ON "Submission"("examId", "studentId");

ALTER TABLE "Exam" ADD CONSTRAINT "Exam_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
