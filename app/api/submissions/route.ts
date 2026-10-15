import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scoreSubmission, isQuestionCorrect, type AnswerValue, type GradingPayload } from "@/lib/grading";
import { ATTEMPT_GRACE_SECONDS, finalizeTimedOutAttempt, riskOfAttempt, currentIpHash } from "@/lib/attempt";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { effectiveMode, isStudentAccess } from "@/lib/access";

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

  /* Tiết kiệm 1 round trip (~1s+): đề và attempt độc lập nhau nên đọc song
   * song. Thứ tự kiểm tra giữ nguyên bên dưới nên mã lỗi trả về không đổi. */
  const [exam, attempt] = await Promise.all([
    prisma.exam.findUnique({ where: { id: examId }, include: { questions: { orderBy: { order: "asc" } } } }),
    prisma.attempt.findUnique({ where: { id: attemptId } }),
  ]);
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
  /* Làm lại được không — quyết định có hiện nút "Làm lại" ở màn kết quả khách.
   * Khách luôn được làm lại (vào lại form = người tham gia mới); học sinh theo
   * số lượt còn lại của đề. */
  let canRetry = true;

  /* Tiết kiệm 1 round trip (~1s+ trên Supabase): đọc nhật ký vi phạm + băm IP
   * chạy SONG SONG với việc xác định người nộp bên dưới (hai việc độc lập nhau).
   * `catch` rỗng để lỡ đường thoát sớm (attempt không hợp lệ) không thành
   * unhandled rejection — `await` vẫn ném lại lỗi như cũ khi chạy tới. */
  const riskPromise = attempt && attempt.examId === examId ? riskOfAttempt(attempt.id) : null;
  riskPromise?.catch(() => {});
  const ipHashPromise = currentIpHash();

  const participantError = await (async (): Promise<NextResponse | null> => {
    if (session?.user) {
      // G6b — hiệu lực theo mode (xem attempts/route.ts).
      if (!isStudentAccess(session.user)) return NextResponse.json({ error: `Bạn đang ở chế độ ${effectiveMode(session.user) === "admin" ? "Quản trị" : "Giáo viên"}. Hãy chuyển sang chế độ Học sinh để nộp bài thi.` }, { status: 403 });
      studentId = session.user.id;
      participantName = session.user.name || "Học sinh";
      const attemptsUsed = await prisma.submission.count({ where: { examId, studentId: session.user.id } });
      // EXAM-1b — `maxAttempts <= 0` = vô hạn: bỏ qua chốt lượt.
      if (exam.maxAttempts > 0 && attemptsUsed >= exam.maxAttempts) {
        const latest = await prisma.submission.findFirst({ where: { examId, studentId: session.user.id }, orderBy: { submittedAt: "desc" } });
        return NextResponse.json({ error: `Bạn đã hết số lần làm bài (${exam.maxAttempts} lần)`, submission: latest }, { status: 409 });
      }
      canRetry = exam.maxAttempts <= 0 || attemptsUsed + 1 < exam.maxAttempts;
      return null;
    }
    if (!exam.allowGuestAttempts) return NextResponse.json({ error: "Đề thi này yêu cầu đăng nhập tài khoản A6Class Edu" }, { status: 401 });
    const token = (await cookies()).get(`edutest_guest_${exam.id}`)?.value;
    if (!token) return NextResponse.json({ error: "Phiên khách không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    const guest = await prisma.guestParticipant.findFirst({ where: { examId, tokenHash: hashToken(token) }, select: { id: true, name: true, submittedAt: true } });
    if (!guest) return NextResponse.json({ error: "Phiên khách không hợp lệ hoặc đã hết hạn" }, { status: 401 });
    if (guest.submittedAt) return NextResponse.json({ error: "Bạn đã nộp bài này rồi" }, { status: 409 });
    guestParticipantId = guest.id;
    participantName = guest.name;
    return null;
  })();
  if (participantError) return participantError;

  /* GĐ1 — kiểm chứng lần làm bài TRƯỚC khi chấm điểm.
   * Attempt là nguồn sự thật duy nhất về thời gian: `startedAt`/`deadlineAt`
   * do server sinh lúc bắt đầu, client không gửi và cũng không tính được. */
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
  const [risk, ipHash] = await Promise.all([riskPromise ?? riskOfAttempt(attempt.id), ipHashPromise]);

  const totalQuestions = exam.questions.length;
  // GRADE-1: điểm có TRỌNG SỐ theo `points` từng câu (trước đây mọi câu bằng
  // nhau dù GV đã cấu hình điểm — đúng lỗi user báo "setting điểm không ăn").
  const { score, correctCount } = scoreSubmission(exam.questions, answers);

  // Dạng mảng: Prisma gửi cả gói trong MỘT round trip. Bản `async (tx) => ...`
  // trước đây phải tuần tự từng lệnh, mỗi lệnh ~1s+ trên Supabase.
  const [submission] = await prisma.$transaction([
    prisma.submission.create({
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
    }),
    // Đóng attempt: xoá `activeKey` (mở lại lượt mới) và ghi mốc đã nộp.
    prisma.attempt.update({ where: { id: attempt.id }, data: { submittedAt: now, activeKey: null } }),
    ...(guestParticipantId ? [prisma.guestParticipant.update({ where: { id: guestParticipantId }, data: { submittedAt: now } })] : []),
  ]);

  /* Chuông báo cho giáo viên: bắn rồi không đợi (fire-and-forget) để khỏi cộng
   * thêm 1 round trip vào đường nộp bài. Rớt thì mất 1 chuông, bài làm và điểm
   * đã chốt chắc ở transaction phía trên nên không ảnh hưởng gì. */
  prisma.notification.create({ data: { userId: exam.teacherId, type: "exam_result", title: "Có người vừa nộp bài", message: `${participantName} vừa nộp bài "${exam.title}" — Điểm: ${score}/10`, link: `/bang-dieu-khien/de-thi/${exam.id}` } }).catch(() => {});

  /* Màn kết quả của KHÁCH nằm ngay trong runner (khách không có /bang-dieu-khien),
   * nên trả kèm dữ liệu "Xem lại đáp án" — CHỈ khi giáo viên bật `showAnswers`
   * (đúng quyền của GV, không rò đáp án ngoài ý muốn). */
  const review = exam.showAnswers
    ? exam.questions.map((q) => {
        const grading = (q.grading ?? null) as GradingPayload | null;
        const userAnswer = answers[q.id];
        let correct: boolean | null;
        if (q.type === "essay" || (q.type === "true_false" && !(grading?.statements ?? []).length) || (q.type === "short_answer" && !(grading?.acceptedAnswers ?? []).length)) {
          correct = null;
        } else {
          correct = isQuestionCorrect({ type: q.type, answer: q.answer, grading }, userAnswer);
        }
        return {
          id: q.id,
          order: q.order,
          type: q.type,
          text: q.text,
          options: q.options,
          answer: q.answer,
          grading: { statements: grading?.statements ?? [], acceptedAnswers: grading?.acceptedAnswers ?? [] },
          explanation: q.explanation,
          userAnswer: userAnswer ?? null,
          correct,
        };
      })
    : undefined;

  return NextResponse.json({
    submission,
    isGuest: Boolean(guestParticipantId),
    resultLink: guestParticipantId ? null : `/bang-dieu-khien/ket-qua/${submission.id}`,
    showAnswers: exam.showAnswers,
    showScoreImmediately: exam.showScoreImmediately,
    canRetry,
    review,
  });
}
