/**
 * Hệ thống thi HTML thuần cho máy iOS cũ (iOS ≤ 15 / Safari < 16.4) —
 * KHÔNG React, KHÔNG Tailwind, KHÔNG JS bắt buộc.
 *
 * Vì sao tồn tại: app chính (Next 16 + Tailwind 4) cần Safari 16.4+. Trên máy
 * cũ, HTML server-render (form nhập tên) vẫn chạy nhưng JS của React không
 * hydrate → trang thi "đứng", bấm đáp án không ăn. Route này render một trang
 * HTML tự chứa, nộp bài bằng form POST thường → chạy được trên mọi máy.
 *
 * KHÔNG chép lại logic chấm điểm: dùng chung `lib/grading` + `lib/attempt`
 * (tạo Attempt, thời gian, xáo trộn) nên điểm và hạn giờ KHÔNG lệch app chính.
 * Khách dùng chung cookie `edutest_guest_<examId>` với app chính.
 */
import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scoreSubmission, isQuestionCorrect, type AnswerValue, type GradingPayload } from "@/lib/grading";
import { startAttempt, guestActiveKey, studentActiveKey, ATTEMPT_GRACE_SECONDS, finalizeTimedOutAttempt } from "@/lib/attempt";
import { isStudentAccess } from "@/lib/access";
import {
  messageView, joinView, examView, resultView, orderQuestions,
  esc, type LegacyQuestion, type ReviewItem,
} from "./html";

type ExamFull = {
  id: string;
  title: string;
  subject: string;
  joinCode: string;
  durationMinutes: number;
  allowGuestAttempts: boolean;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  maxAttempts: number;
  showAnswers: boolean;
  showScoreImmediately: boolean;
  status: string;
  hidden: boolean;
  deletedAt: Date | null;
  openAt: Date | null;
  closeAt: Date | null;
  teacherId: string;
  questions: LegacyQuestion[];
};

const cookieName = (examId: string) => `edutest_guest_${examId}`;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

async function loadExam(code: string): Promise<ExamFull | null> {
  const exam = await prisma.exam.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  return exam as ExamFull | null;
}

function isUsable(exam: ExamFull | null): exam is ExamFull {
  return Boolean(exam && exam.status === "published" && !exam.hidden && !exam.deletedAt);
}

const fmtVN = (d: Date) => d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

function invalidExam() {
  return htmlResponse(messageView({ title: "Mã tham gia không hợp lệ", text: "Đề thi không tồn tại hoặc chưa được công bố.", action: { href: "/", label: "Về trang chủ" } }));
}

/* Máy đích không chạy nổi React nên một trang 500 trắng của Next là ngõ cụt —
 * luôn trả một trang thông báo HTML đọc được, kèm nút về trang chủ. */
function busyView() {
  return htmlResponse(messageView({ title: "Hệ thống đang bận", text: "Chưa tải được đề thi. Em vui lòng thử lại sau ít phút.", action: { href: "/", label: "Về trang chủ" } }), 503);
}

/** Xem lại bài làm — chép đúng bộ luật của `POST /api/submissions` để hai đường
 *  không lệch (chỉ trả khi giáo viên bật `showAnswers`). */
function buildReview(exam: ExamFull, answers: Record<string, AnswerValue>): ReviewItem[] | undefined {
  if (!exam.showAnswers) return undefined;
  return exam.questions.map((q) => {
    const grading = (q.grading ?? null) as GradingPayload | null;
    const userAnswer = answers[q.id];
    let correct: boolean | null;
    if (q.type === "essay" || (q.type === "true_false" && !(grading?.statements ?? []).length) || (q.type === "short_answer" && !(grading?.acceptedAnswers ?? []).length)) {
      correct = null;
    } else {
      correct = isQuestionCorrect({ type: q.type, answer: q.answer, grading }, userAnswer);
    }
    return {
      order: q.order,
      type: q.type,
      text: q.text,
      options: q.options,
      answer: q.answer,
      grading: { statements: grading?.statements ?? [], acceptedAnswers: grading?.acceptedAnswers ?? [], image: grading?.image },
      explanation: q.explanation,
      userAnswer: userAnswer ?? null,
      correct,
    };
  });
}

type GuestLite = { id: string; name: string; className: string; submittedAt: Date | null };

async function guestResult(exam: ExamFull, guest: GuestLite): Promise<string> {
  const sub = await prisma.submission.findUnique({ where: { guestParticipantId: guest.id } });
  if (!sub) return joinView({ code: exam.joinCode, title: exam.title, error: "Không tìm thấy bài làm. Em thử làm lại nhé." });
  return resultView({
    code: exam.joinCode,
    title: exam.title,
    participant: `${guest.name} · ${guest.className}`,
    showScore: exam.showScoreImmediately,
    score: sub.score,
    correctCount: sub.correctCount,
    totalQuestions: sub.totalQuestions,
    showAnswers: exam.showAnswers,
    canRetry: true,
    review: buildReview(exam, sub.answers as Record<string, AnswerValue>),
  });
}

/* GET — quyết định hiển thị: nhập tên → làm bài → (đã nộp) kết quả. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    return await handleGet(request, ctx);
  } catch (err) {
    console.error("[thi-cu] GET failed", err);
    return busyView();
  }
}

async function handleGet(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const exam = await loadExam(code);
  if (!isUsable(exam)) return invalidExam();

  const now = new Date();
  if (exam.openAt && now < exam.openAt) {
    // Meta refresh: trang này không có JS nên đây là cách tới giờ mở mà không
    // cần học sinh F5 thủ công. Giây = đúng tới giờ mở + 2s bù lệch đồng hồ.
    const refreshSeconds = Math.max(5, Math.ceil((exam.openAt.getTime() - now.getTime()) / 1000) + 2);
    return htmlResponse(messageView({ title: "Chưa đến giờ mở đề", text: `Đề sẽ mở lúc ${fmtVN(exam.openAt)}.`, pill: { label: "Chưa mở", cls: "warn" }, refresh: refreshSeconds }));
  }
  if (exam.closeAt && now > exam.closeAt) {
    return htmlResponse(messageView({ title: "Đề thi đã đóng", text: `Đề đã đóng lúc ${fmtVN(exam.closeAt)}.`, pill: { label: "Đã đóng", cls: "bad" } }));
  }
  if (!exam.questions.length) return htmlResponse(messageView({ title: "Đề chưa có câu hỏi", text: "Giáo viên chưa thêm câu hỏi cho đề này.", action: { href: "/", label: "Về trang chủ" } }));

  const session = await auth();
  const token = request.cookies.get(cookieName(exam.id))?.value;
  const guest = token
    ? await prisma.guestParticipant.findFirst({ where: { examId: exam.id, tokenHash: hashToken(token) }, select: { id: true, name: true, className: true, submittedAt: true } })
    : null;

  let studentId: string | null = null;
  let guestId: string | null = null;
  let label = "Học sinh";
  let activeKey = "";

  if (session?.user) {
    if (!isStudentAccess(session.user)) {
      return htmlResponse(messageView({ title: "Đang ở chế độ khác", text: "Hãy chuyển sang chế độ Học sinh rồi mở lại link thi.", action: { href: "/bang-dieu-khien", label: "Về bảng điều khiển" } }));
    }
    studentId = session.user.id;
    label = session.user.name || "Học sinh";
    activeKey = studentActiveKey(studentId);
  } else {
    if (!exam.allowGuestAttempts) {
      return htmlResponse(messageView({ title: "Đề thi chính thức", text: "Đề này yêu cầu đăng nhập tài khoản A6Class Edu.", action: { href: "/dang-nhap", label: "Đăng nhập" } }));
    }
    if (!guest) return htmlResponse(joinView({ code: exam.joinCode, title: exam.title }));
    if (guest.submittedAt) return htmlResponse(await guestResult(exam, guest));
    guestId = guest.id;
    label = `${guest.name} · ${guest.className}`;
    activeKey = guestActiveKey(token!);
  }

  const started = await startAttempt({
    exam,
    studentId,
    guestParticipantId: guestId,
    activeKey,
    questions: exam.questions,
  });

  if (started.status === "active_elsewhere") {
    return htmlResponse(messageView({ title: "Bạn đang làm bài thi khác", text: "Hãy hoàn thành bài đang mở trước khi vào đề này.", action: { href: "/", label: "Về trang chủ" } }));
  }
  if (started.status === "max_attempts") {
    const [used, latest] = await Promise.all([
      prisma.submission.count({ where: { examId: exam.id, studentId: studentId! } }),
      prisma.submission.findFirst({ where: { examId: exam.id, studentId: studentId! }, orderBy: { submittedAt: "desc" } }),
    ]);
    if (!latest) return htmlResponse(messageView({ title: "Đã hết số lần làm bài", text: `Bạn đã dùng ${used}/${exam.maxAttempts} lượt.`, action: { href: "/", label: "Về trang chủ" } }));
    return htmlResponse(resultView({
      code: exam.joinCode,
      title: exam.title,
      participant: label,
      showScore: exam.showScoreImmediately,
      score: latest.score,
      correctCount: latest.correctCount,
      totalQuestions: latest.totalQuestions,
      showAnswers: exam.showAnswers,
      canRetry: false,
      attemptsNote: `Đã làm ${used}/${exam.maxAttempts} lượt`,
      review: buildReview(exam, latest.answers as Record<string, AnswerValue>),
    }));
  }

  const attempt = started.attempt;
  return htmlResponse(examView({
    code: exam.joinCode,
    title: exam.title,
    subject: exam.subject,
    participant: label,
    questions: orderQuestions(exam.questions, attempt.questionOrder),
    optionOrder: attempt.optionOrder,
    remainingSeconds: attempt.remainingSeconds,
    deadlineLabel: fmtVN(attempt.deadlineAt),
  }));
}

/* POST — ba hành động: join (tạo phiên khách) / submit (nộp bài) / leave (làm lại). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    return await handlePost(request, ctx);
  } catch (err) {
    console.error("[thi-cu] POST failed", err);
    return busyView();
  }
}

async function handlePost(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const exam = await loadExam(code);
  if (!isUsable(exam)) return invalidExam();

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("form-urlencoded") && !contentType.includes("multipart/form-data")) {
    return htmlResponse(messageView({ title: "Yêu cầu không hợp lệ", text: "Vui lòng nộp lại từ trang làm bài.", action: { href: `/thi-cu/${esc(exam.joinCode)}`, label: "Quay lại" } }));
  }
  const form = await request.formData();
  const action = String(form.get("action") || "");

  if (action === "join") return handleJoin(request, exam, form);
  if (action === "leave") return handleLeave(request, exam);
  if (action === "submit") return handleSubmit(request, exam, form);
  return htmlResponse(messageView({ title: "Yêu cầu không hợp lệ", text: "Thao tác không được hỗ trợ.", action: { href: `/thi-cu/${esc(exam.joinCode)}`, label: "Quay lại" } }));
}

function handleJoin(request: NextRequest, exam: ExamFull, form: FormData) {
  const name = cleanText(form.get("name"), 100);
  const className = cleanText(form.get("class"), 50);
  if (!name || !className) {
    return htmlResponse(joinView({ code: exam.joinCode, title: exam.title, error: "Vui lòng nhập đầy đủ họ tên và lớp.", name, className }));
  }
  if (!exam.allowGuestAttempts) {
    return htmlResponse(messageView({ title: "Đề thi chính thức", text: "Đề này yêu cầu đăng nhập tài khoản A6Class Edu.", action: { href: "/dang-nhap", label: "Đăng nhập" } }));
  }
  return (async () => {
    const token = randomBytes(32).toString("base64url");
    await prisma.guestParticipant.create({ data: { examId: exam.id, name, className, tokenHash: hashToken(token) } });
    const res = NextResponse.redirect(new URL(`/thi-cu/${exam.joinCode}`, request.url), 303);
    res.cookies.set(cookieName(exam.id), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(60 * 60, exam.durationMinutes * 60 + 60 * 60),
    });
    return res;
  })();
}

function handleLeave(request: NextRequest, exam: ExamFull) {
  const res = NextResponse.redirect(new URL(`/thi-cu/${exam.joinCode}`, request.url), 303);
  res.cookies.set(cookieName(exam.id), "", { path: "/", maxAge: 0 });
  return res;
}

async function handleSubmit(request: NextRequest, exam: ExamFull, form: FormData) {
  const reload = () => htmlResponse(messageView({ title: "Cần tải lại trang", text: "Phiên làm bài đã cũ. Em quay lại và vào lại đề nhé.", action: { href: `/thi-cu/${esc(exam.joinCode)}`, label: "Vào lại đề" } }));
  const backTo = () => NextResponse.redirect(new URL(`/thi-cu/${exam.joinCode}`, request.url), 303);

  const session = await auth();
  const token = request.cookies.get(cookieName(exam.id))?.value;

  let studentId: string | null = null;
  let guestId: string | null = null;
  let activeKey = "";

  if (session?.user) {
    if (!isStudentAccess(session.user)) return htmlResponse(messageView({ title: "Đang ở chế độ khác", text: "Hãy chuyển sang chế độ Học sinh rồi nộp lại." }));
    studentId = session.user.id;
    activeKey = studentActiveKey(studentId);
  } else {
    if (!exam.allowGuestAttempts || !token) return reload();
    const guest = await prisma.guestParticipant.findFirst({ where: { examId: exam.id, tokenHash: hashToken(token) }, select: { id: true, submittedAt: true } });
    if (!guest) return reload();
    if (guest.submittedAt) return backTo();
    guestId = guest.id;
    activeKey = guestActiveKey(token);
  }

  const attempt = await prisma.attempt.findUnique({ where: { activeKey } });
  if (!attempt || attempt.examId !== exam.id) return reload();
  if (attempt.studentId !== studentId || attempt.guestParticipantId !== guestId) return reload();
  if (attempt.submittedAt) return backTo();

  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000);
  const allowedSeconds = exam.durationMinutes * 60 + ATTEMPT_GRACE_SECONDS;
  if (elapsedSeconds > allowedSeconds) {
    // Quá hạn chót: chốt attempt "hết giờ" (bài rỗng) rồi cho xem trang kết quả.
    await finalizeTimedOutAttempt(attempt.id);
    return backTo();
  }

  const answers: Record<string, AnswerValue> = {};
  for (const q of exam.questions) {
    if (q.type === "mcq") {
      const v = form.get(`a_${q.id}`);
      if (typeof v === "string" && v) answers[q.id] = v;
    } else if (q.type === "true_false") {
      const sts = (q.grading as GradingPayload | null)?.statements ?? [];
      const picked: Record<string, boolean> = {};
      let answered = 0;
      sts.forEach((_, i) => {
        const v = form.get(`t_${q.id}_${i}`);
        if (v === "true" || v === "false") {
          picked[String(i)] = v === "true";
          answered += 1;
        }
      });
      if (answered > 0) answers[q.id] = picked;
    } else if (q.type === "essay") {
      answers[q.id] = String(form.get(`e_${q.id}`) ?? "");
    } else {
      answers[q.id] = String(form.get(`s_${q.id}`) ?? "");
    }
  }

  const durationSeconds = Math.max(0, elapsedSeconds);
  const { score, correctCount } = scoreSubmission(exam.questions, answers);
  const totalQuestions = exam.questions.length;

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: {
        examId: exam.id,
        studentId,
        guestParticipantId: guestId,
        attemptId: attempt.id,
        answers,
        correctCount,
        totalQuestions,
        score,
        durationSeconds,
      },
    });
    await tx.attempt.update({ where: { id: attempt.id }, data: { submittedAt: now, activeKey: null } });
    if (guestId) await tx.guestParticipant.update({ where: { id: guestId }, data: { submittedAt: now } });
    return created;
  });

  let participantName = session?.user?.name || "Học sinh";
  if (guestId) {
    const g = await prisma.guestParticipant.findUnique({ where: { id: guestId }, select: { name: true } });
    participantName = g?.name || participantName;
  }
  prisma.notification.create({
    data: { userId: exam.teacherId, type: "exam_result", title: "Có người vừa nộp bài", message: `${participantName} vừa nộp bài "${exam.title}" — Điểm: ${score}/10`, link: `/bang-dieu-khien/de-thi/${exam.id}` },
  }).catch(() => {});

  void submission;
  return backTo();
}
