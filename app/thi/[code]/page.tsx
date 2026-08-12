import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ExamTakingClient } from "./exam-taking-client";
import { GuestJoin } from "./guest-join";
import { Trophy, ArrowLeft, UserRound } from "lucide-react";

export default async function ThiPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { code } = await params;
  const { preview } = await searchParams;
  const normalizedCode = code.toUpperCase();
  const session = await auth();

  const exam = await prisma.exam.findUnique({
    where: { joinCode: normalizedCode },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  if (!exam || exam.status !== "published") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#FEE2E2] p-8 max-w-md w-full text-center">
          <p className="text-sm font-semibold text-[#DC2626] mb-2">Không tìm thấy</p>
          <h1 className="text-xl font-bold text-[#0F172A] mb-3">Mã tham gia không hợp lệ</h1>
          <Link href="/vao-thi" className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB]">
            <ArrowLeft size={14} /> Nhập mã khác
          </Link>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    if (!exam.allowGuestAttempts) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md w-full text-center">
            <UserRound size={30} className="mx-auto mb-4 text-[#2563EB]" />
            <p className="text-sm font-semibold text-[#2563EB] mb-2">Đề thi chính thức</p>
            <h1 className="text-xl font-bold text-[#0F172A] mb-3">Cần đăng nhập</h1>
            <p className="text-sm text-[#64748B] mb-6">Giáo viên không cho phép khách tham gia đề thi này.</p>
            <Link href="/dang-nhap" className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-lg hover:bg-[#1D4ED8]">
              Đăng nhập để làm bài
            </Link>
          </div>
        </div>
      );
    }

    const cookieStore = await cookies();
    const guestToken = cookieStore.get(`edutest_guest_${exam.id}`)?.value;
    if (!guestToken) {
      return <GuestJoin code={exam.joinCode} title={exam.title} />;
    }

    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(guestToken).digest("hex");
    const guest = await prisma.guestParticipant.findFirst({ where: { examId: exam.id, tokenHash } });

    if (!guest) {
      return <GuestJoin code={exam.joinCode} title={exam.title} />;
    }

    if (guest.submittedAt) {
      const sub = await prisma.submission.findUnique({ where: { guestParticipantId: guest.id } });
      if (sub) {
        const scoreCol = sub.score >= 8 ? "#16A34A" : sub.score >= 5 ? "#D97706" : "#DC2626";
        return (
          <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md w-full text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `${scoreCol}15` }}>
                <Trophy size={28} style={{ color: scoreCol }} />
              </div>
              <p className="text-sm text-[#64748B] mb-1">Đã nộp bài</p>
              <p className="text-sm font-semibold text-[#0F172A]">{guest.name} · {guest.className}</p>
              <h1 className="text-3xl font-bold mb-1 mt-2" style={{ color: scoreCol }}>{sub.score}/10</h1>
              <p className="text-sm text-[#94A3B8] mb-6">Đúng {sub.correctCount}/{sub.totalQuestions} câu</p>
              <p className="text-xs text-[#94A3B8]">Bạn có thể đóng trang này. Kết quả đã được ghi nhận.</p>
            </div>
          </div>
        );
      }
    }

    return (
      <ExamTakingClient
        backHref="/vao-thi"
        exam={{
          id: exam.id,
          title: exam.title,
          subject: exam.subject,
          durationMinutes: exam.durationMinutes,
          joinCode: exam.joinCode,
          isGuest: true,
          participantName: guest.name,
          participantClass: guest.className,
          questions: exam.questions.map((q) => ({ id: q.id, text: q.text, options: q.options, order: q.order })),
        }}
      />
    );
  }

  // Teacher preview: open the real student exam UI without creating a submission.
  if (preview === "1" && session.user.role === "teacher") {
    return (
      <ExamTakingClient
        preview
        backHref={`/bang-dieu-khien/de-thi/${exam.id}`}
        exam={{
          id: exam.id,
          title: exam.title,
          subject: exam.subject,
          durationMinutes: exam.durationMinutes,
          joinCode: exam.joinCode,
          isGuest: false,
          questions: exam.questions.map((q) => ({ id: q.id, text: q.text, options: q.options, order: q.order })),
        }}
      />
    );
  }

  if (session.user.role !== "student") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md w-full text-center">
          <p className="text-sm font-semibold text-[#D97706] mb-2">Không đúng vai trò</p>
          <h1 className="text-xl font-bold text-[#0F172A] mb-3">Tài khoản này không phải học sinh</h1>
          <Link href="/bang-dieu-khien" className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB]">
            <ArrowLeft size={14} /> Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const submission = await prisma.submission.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId: session.user.id } },
  });

  if (submission) {
    const scoreCol = submission.score >= 8 ? "#16A34A" : submission.score >= 5 ? "#D97706" : "#DC2626";
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `${scoreCol}15` }}>
            <Trophy size={28} style={{ color: scoreCol }} />
          </div>
          <p className="text-sm text-[#64748B] mb-1">Bạn đã nộp bài</p>
          <h1 className="text-3xl font-bold mb-1" style={{ color: scoreCol }}>{submission.score}/10</h1>
          <p className="text-sm text-[#94A3B8] mb-6">Đúng {submission.correctCount}/{submission.totalQuestions} câu</p>
          <Link href="/bang-dieu-khien" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-lg hover:bg-[#1D4ED8]">
            <ArrowLeft size={14} /> Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ExamTakingClient
      backHref="/bang-dieu-khien/de-thi"
      exam={{
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        durationMinutes: exam.durationMinutes,
        joinCode: exam.joinCode,
        isGuest: false,
        questions: exam.questions.map((q) => ({ id: q.id, text: q.text, options: q.options, order: q.order })),
      }}
    />
  );
}
