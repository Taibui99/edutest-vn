import Link from "next/link";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Trophy, ArrowLeft, UserRound, Clock } from "lucide-react";

const ExamTakingClientV2 = dynamic(() => import("./exam-taking-client-v2").then((m) => m.ExamTakingClientV2));
const GuestJoin = dynamic(() => import("./guest-join").then((m) => m.GuestJoin));

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const exam = await prisma.exam.findUnique({ where: { joinCode: code.toUpperCase() }, select: { title: true } });
  return exam
    ? { title: `${exam.title} — EduTest` }
    : { title: "Mã tham gia không hợp lệ — EduTest" };
}

type ClientGrading = { statements?: Array<{ text: string; answer: boolean }>; acceptedAnswers?: string[] } | null;

export default async function ThiPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { code } = await params;
  const { preview } = await searchParams;
  const normalizedCode = code.toUpperCase();
  const session = await auth();
  const exam = await prisma.exam.findUnique({ where: { joinCode: normalizedCode }, include: { questions: { orderBy: { order: "asc" } } } });
  const mapQuestions = () => exam?.questions.map((q) => ({ id: q.id, type: q.type, text: q.text, options: q.options, answer: q.answer, grading: q.grading as ClientGrading, order: q.order })) || [];

  if (!exam || exam.status !== "published" || exam.hidden || exam.deletedAt) return <div className="min-h-screen grid place-items-center bg-[#F6F5FB] p-4"><div className="rounded-2xl bg-white p-8 text-center"><h1 className="text-xl font-bold">Mã tham gia không hợp lệ</h1><Link href="/vao-thi" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#6C4CF1]"><ArrowLeft size={14}/> Nhập mã khác</Link></div></div>;

  const now = new Date();
  const notStarted = exam.openAt ? now < exam.openAt : false;
  const expired = exam.closeAt ? now > exam.closeAt : false;
  const isPreview = preview === "1" && session?.user?.role === "teacher";
  const fmt = (d: Date) => d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  if ((notStarted || expired) && !isPreview) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F6F5FB] p-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FCF3E2] text-[#B97F10]"><Clock size={24} /></div>
          {notStarted ? (
            <>
              <h1 className="text-xl font-bold">Chưa đến giờ mở đề</h1>
              <p className="mt-2 text-sm text-[#6B7280]">Đề thi sẽ mở lúc <span className="font-bold text-[#B97F10]">{exam.openAt ? fmt(exam.openAt) : ""}</span></p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">Đề thi đã đóng</h1>
              <p className="mt-2 text-sm text-[#6B7280]">Đề thi đã đóng lúc <span className="font-bold text-[#B97F10]">{exam.closeAt ? fmt(exam.closeAt) : ""}</span></p>
            </>
          )}
          <Link href="/vao-thi" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6C4CF1] px-5 py-2.5 text-sm font-semibold text-white">
            <ArrowLeft size={14}/> Nhập mã khác
          </Link>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    if (!exam.allowGuestAttempts) return <div className="min-h-screen grid place-items-center bg-[#F6F5FB] p-4"><div className="max-w-md rounded-2xl bg-white p-8 text-center"><UserRound size={30} className="mx-auto mb-4 text-[#6C4CF1]"/><p className="text-sm font-semibold text-[#6C4CF1]">Đề thi chính thức</p><h1 className="mt-2 text-xl font-bold">Cần đăng nhập</h1><p className="my-4 text-sm text-[#6B7280]">Giáo viên không cho phép khách tham gia đề thi này.</p><Link href="/dang-nhap" className="inline-flex w-full justify-center rounded-lg bg-[#6C4CF1] px-5 py-2.5 text-sm font-semibold text-white">Đăng nhập để làm bài</Link></div></div>;
    const token = (await cookies()).get(`edutest_guest_${exam.id}`)?.value;
    if (!token) return <GuestJoin code={exam.joinCode} title={exam.title} />;
    const { createHash } = await import("node:crypto");
    const guest = await prisma.guestParticipant.findFirst({ where: { examId: exam.id, tokenHash: createHash("sha256").update(token).digest("hex") } });
    if (!guest) return <GuestJoin code={exam.joinCode} title={exam.title} />;
    if (guest.submittedAt) { const sub = await prisma.submission.findUnique({ where: { guestParticipantId: guest.id } }); if (sub) return <div className="min-h-screen grid place-items-center bg-[#F6F5FB] p-4"><div className="rounded-2xl bg-white p-8 text-center"><Trophy className="mx-auto mb-4 text-[#189A6C]"/><p className="text-sm font-semibold">Đã nộp bài</p><p className="mt-2 text-3xl font-black text-[#189A6C]">{sub.score}/10</p><p className="mt-1 text-sm text-[#6B7280]">{guest.name} · {guest.className}</p></div></div>; }
    return <ExamTakingClientV2 backHref="/vao-thi" exam={{ id: exam.id, title: exam.title, subject: exam.subject, durationMinutes: exam.durationMinutes, joinCode: exam.joinCode, isGuest: true, showScoreImmediately: exam.showScoreImmediately, participantName: guest.name, participantClass: guest.className, shuffleQuestions: exam.shuffleQuestions, shuffleAnswers: exam.shuffleAnswers, questions: mapQuestions() }} />;
  }

  if (preview === "1" && session.user.role === "teacher") return <ExamTakingClientV2 preview backHref={`/bang-dieu-khien/de-thi/${exam.id}`} exam={{ id: exam.id, title: exam.title, subject: exam.subject, durationMinutes: exam.durationMinutes, joinCode: exam.joinCode, isGuest: false, showScoreImmediately: exam.showScoreImmediately, questions: mapQuestions() }} />;
  if (session.user.role !== "student") return <div className="min-h-screen grid place-items-center bg-[#F6F5FB] p-4"><div className="rounded-2xl bg-white p-8 text-center"><p className="font-semibold text-[#B97F10]">Tài khoản này không phải học sinh</p><Link href="/bang-dieu-khien" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#6C4CF1]"><ArrowLeft size={14}/> Về trang chủ</Link></div></div>;
  const [attemptsUsed, latestSubmission] = await Promise.all([
    prisma.submission.count({ where: { examId: exam.id, studentId: session.user.id } }),
    prisma.submission.findFirst({ where: { examId: exam.id, studentId: session.user.id }, orderBy: { submittedAt: "desc" } }),
  ]);
  if (attemptsUsed >= exam.maxAttempts) return <div className="min-h-screen grid place-items-center bg-[#F6F5FB] p-4"><div className="rounded-2xl bg-white p-8 text-center"><Trophy className="mx-auto mb-4 text-[#189A6C]"/><p className="text-sm font-semibold">Bạn đã hết số lần làm bài</p>{latestSubmission && <p className="mt-2 text-3xl font-black text-[#189A6C]">{latestSubmission.score}/10</p>}<p className="mt-2 text-xs text-[#6B7280]">Đã làm {attemptsUsed}/{exam.maxAttempts} lượt</p><Link href="/bang-dieu-khien" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#6C4CF1] px-5 py-2.5 text-sm font-semibold text-white"><ArrowLeft size={14}/> Về trang chủ</Link></div></div>;
  return <ExamTakingClientV2 backHref="/bang-dieu-khien/de-thi" exam={{ id: exam.id, title: exam.title, subject: exam.subject, durationMinutes: exam.durationMinutes, joinCode: exam.joinCode, isGuest: false, shuffleQuestions: exam.shuffleQuestions, shuffleAnswers: exam.shuffleAnswers, showScoreImmediately: exam.showScoreImmediately, questions: mapQuestions() }} />;
}
