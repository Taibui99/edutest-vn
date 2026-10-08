import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isQuestionCorrect, isAutoGraded, type AnswerValue } from "@/lib/grading";
import { ATTEMPT_GRACE_SECONDS, finalizeTimedOutAttempt, riskOfAttempt, currentIpHash } from "@/lib/attempt";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

type AnswerMap = Record<string, AnswerValue>;

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function POST(request: NextRequest) {
  const rl = rateLimit(`submit:${clientIp(request)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Bạn nộp bài quá nhanh. Thử lại sau 1 phút." }, { status: 429 });
  const session = await auth();
  const body = await request.json() as { examId?: unknown; attemptId?: unknown; answers?: unknown };
  const examId = typeof body.examId === "string" ? body.examId : "";
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  const answers = (body.answers && typeof body.answers === "object" ? body.answers : {}) as AnswerMap;
  if (!examId) return NextResponse.json({ error: "Thiếu mã đề thi" }, { status: 400 });
  /* GĐ1: thời gian do server chốt từ `Attempt.startedAt`/`deadlineAt`.
   * Không nhận `durationSeconds` từ client nữa — trước đây client gửi con số
   * tự tính nên server không cách nào kiểm chứng. */
  if (!attemptId) return NextResponse.json({ error: "Thiếu mã lần làm bài. Vui lòng tải lại trang." }, { status: 400 });

  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { questions: { orderBy: { order: "asc" } } } });
  if (!exam || exam.status !== "published" || exam.hidden || exam.deletedAt) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (!exam.questions.length) {
    const err = new Error("Đề thi không có câu hỏi nào (examId=" + examId + ")");
    console.error("[submissions]", err);
    return NextResponse.json({ error: "Đề thi không có câu hỏi nào" }, { status: 400 });
  }

  const now = new Date();
  if (exam.openAt && now < exam.openAt) return NextResponse.json({ error: "Đề thi chưa mở" }, { status: 403 });
  if (exam.closeAt && now > exam.closeAt) return NextResponse.json({ error: "Đề thi đã đóng" }, { status: 403 });

  let studentId: string | null = null;
  let guestParticipantId: string | null = null;
  let participantName = "Học sinh";

  if (session?.user) {
    if (session.user.role !== "student") return NextResponse.json({ error: "Chỉ học sinh mới nộp bài thi" }, { status: 403 });
    studentId = session.user.id;
    participantName = session.user.name || "Học sinh";
    const attemptsUsed = await prisma.submission.count({ where: { examId, studentId: session.user.id } });
    if (attemptsUsed >= exam.maxAttempts) {
      const latest = await prisma.submission.findFirst({ where: { examId, studentId: session.user.id }, orderBy: { submittedAt: "desc" } });
      return NextResponse.json({ error: `Bạn đã hết số lần làm bài (${exam.maxAttempts} lần)`, submission: latest }, { status: 409 });
    }
  } else {
    if (!exam.allowGuestAttempts) return NextResponse.json({ error: "Đề thi này yêu cầu đăng nhập tài khoản A6Class Edu" }, { status: 401 });
    const token = (await cookies()).get(`edutest_guest_${exam.id}`)?.value;
    if (!token) return NextResponse.json({ error: "Phiên khách không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    const guest = await prisma.guestParticipant.findFirst({ where: { examId, tokenHash: hashToken(token) }, select: { id: true, name: true, submittedAt: true } });
    if (!guest) return NextResponse.json({ error: "Phiên khách không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    if (guest.submittedAt) return NextResponse.json({ error: "Bạn đã nộp bài này rồi" }, { status: 409 });
    guestParticipantId = guest.id;
    participantName = guest.name;
  }

  /* GĐ1 — kiểm chứng lần làm bài TRƯỚC khi chấm điểm.
   * Attempt là nguồn sự thật duy nhất về thời gian: `startedAt`/`deadlineAt`
   * do server sinh lúc bắt đầu, client không gửi và cũng không tính được. */
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.examId !== examId) return NextResponse.json({ error: "Lần làm bài không hợp lệ. Vui lòng tải lại trang." }, { status: 400 });
  if (attempt.studentId !== studentId || attempt.guestParticipantId !== guestParticipantId) return NextResponse.json({ error: "Bạn không sở hữu lần làm bài này." }, { status: 403 });
  if (attempt.submittedAt) return NextResponse.json({ error: "Bài thi đã được nộp." }, { status: 409 });

  const elapsedSeconds = Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000);
  const allowedSeconds = exam.durationMinutes * 60 + ATTEMPT_GRACE_SECONDS;
  /* Quá hạn chót (deadline + grace): không nhận câu trả lời nữa, nhưng VẪN chốt
   * attempt với bài làm rỗng. Nếu chỉ từ chối không chốt thì attempt giữ `activeKey`
   * vĩnh viễn → học sinh kẹt, không vào lại được đề nào. Dùng helper dùng chung
   * với `startAttempt` để hai đường không bao giờ lệch nhau. */
  if (elapsedSeconds > allowedSeconds) {
    const finalised = await finalizeTimedOutAttempt(attempt.id);
    if (!finalised) return NextResponse.json({ error: "Bài thi đã được nộp." }, { status: 409 });
    return NextResponse.json(
      { error: "Đã hết thời gian làm bài. Bài làm của bạn không được ghi nhận.", timedOut: true, submission: finalised },
      { status: 409 },
    );
  }

  const durationSeconds = Math.max(0, elapsedSeconds);

  /* GĐ2 — chốt cờ rủi ro cùng lúc với bài làm. Đọc nhật ký vi phạm đã ghi
   * trong lúc thi rồi cộng điểm: chỉ để giáo viên xem, KHÔNG trừ điểm,
   * KHÔNG làm mất bài làm (ROADMAP — "Chống gian lận khi thi"). */
  const [risk, ipHash] = await Promise.all([riskOfAttempt(attempt.id), currentIpHash()]);

  const correctCount = exam.questions.reduce((count, question) => isQuestionCorrect(question, answers[question.id]) ? count + 1 : count, 0);
  const totalQuestions = exam.questions.length;
  const autoGradedCount = exam.questions.filter((q) => isAutoGraded(q)).length;
  const score = autoGradedCount > 0 ? Number(((correctCount / autoGradedCount) * 10).toFixed(2)) : 0;

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: {
        examId,
        studentId,
        guestParticipantId,
        attemptId,
        answers,
        correctCount,
        totalQuestions,
        score,
        durationSeconds,
        violationCount: risk.violationCount,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        autoSubmitted: risk.autoSubmitted,
        ipHash,
      },
    });
    // Đóng attempt: xoá `activeKey` (mở lại lượt mới) và ghi mốc đã nộp.
    await tx.attempt.update({ where: { id: attempt.id }, data: { submittedAt: now, activeKey: null } });
    if (guestParticipantId) await tx.guestParticipant.update({ where: { id: guestParticipantId }, data: { submittedAt: now } });
    return created;
  });

  try {
    await prisma.notification.create({ data: { userId: exam.teacherId, type: "exam_result", title: "Có người vừa nộp bài", message: `${participantName} vừa nộp bài "${exam.title}" — Điểm: ${score}/10`, link: `/bang-dieu-khien/de-thi/${exam.id}` } });
  } catch { /* ignore notification errors */ }

  return NextResponse.json({ submission, isGuest: Boolean(guestParticipantId), resultLink: guestParticipantId ? null : `/bang-dieu-khien/ket-qua/${submission.id}` });
}
