import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/app/components/logo";
import { prisma } from "@/lib/prisma";
import { ExamTakingClient } from "./exam-taking-client";

export default async function ThiPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/dang-nhap");
  }

  if (session.user.role !== "student") {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-14 text-center sm:px-6">
          <div className="rounded-2xl border border-amber-100 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-amber-600">Không đúng vai trò</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Tài khoản này không phải học sinh</h1>
            <p className="mt-2 text-sm text-slate-600">
              Vai trò hiện tại của bạn là &quot;{session.user.role}&quot;. Nếu bạn nghĩ đây là nhầm lẫn (ví dụ
              vừa đổi vai trò tài khoản), hãy đăng xuất rồi đăng nhập lại để làm mới phiên đăng nhập.
            </p>
            <Link
              href="/bang-dieu-khien"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-6 text-sm font-semibold text-white hover:bg-green-700"
            >
              Về dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { code } = await params;
  const exam = await prisma.exam.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      submissions: {
        where: { studentId: session.user.id },
        take: 1,
      },
    },
  });

  if (!exam || exam.status !== "published") {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-14 text-center sm:px-6">
          <div className="rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-red-600">Không tìm thấy đề thi</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Mã tham gia không hợp lệ</h1>
            <Link
              href="/vao-thi"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-6 text-sm font-semibold text-white hover:bg-green-700"
            >
              Nhập mã khác
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (exam.submissions.length > 0) {
    const submission = exam.submissions[0];

    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-14 text-center sm:px-6">
          <div className="rounded-2xl border border-green-100 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-green-600">Bạn đã nộp bài</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{submission.score}/10 điểm</h1>
            <p className="mt-2 text-sm text-slate-600">
              Đúng {submission.correctCount}/{submission.totalQuestions} câu.
            </p>
            <Link
              href="/bang-dieu-khien"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-green-600 px-6 text-sm font-semibold text-white hover:bg-green-700"
            >
              Về dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
          <p className="text-sm font-medium opacity-80">{exam.subject} · Mã {exam.joinCode}</p>
          <h1 className="mt-1 text-2xl font-bold">{exam.title}</h1>
          <p className="mt-2 text-sm opacity-80">
            Thời gian {exam.durationMinutes} phút · {exam.questions.length} câu hỏi
          </p>
        </div>

        <ExamTakingClient
          exam={{
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            durationMinutes: exam.durationMinutes,
            joinCode: exam.joinCode,
            questions: exam.questions.map((question) => ({
              id: question.id,
              text: question.text,
              options: question.options,
              order: question.order,
            })),
          }}
        />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-green-100 bg-white sticky top-0 z-10">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <Link href="/bang-dieu-khien" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          Dashboard
        </Link>
      </div>
    </header>
  );
}
