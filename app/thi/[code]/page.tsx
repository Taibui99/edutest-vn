import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ExamTakingClient } from "./exam-taking-client";
import { Trophy, ArrowLeft } from "lucide-react";

export default async function ThiPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");

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

  const { code } = await params;
  const exam = await prisma.exam.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: {
      questions: { orderBy: { order: "asc" } },
      submissions: { where: { studentId: session.user.id }, take: 1 },
    },
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

  if (exam.submissions.length > 0) {
    const sub = exam.submissions[0];
    const scoreCol = sub.score >= 8 ? "#16A34A" : sub.score >= 5 ? "#D97706" : "#DC2626";
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `${scoreCol}15` }}>
            <Trophy size={28} style={{ color: scoreCol }} />
          </div>
          <p className="text-sm text-[#64748B] mb-1">Bạn đã nộp bài</p>
          <h1 className="text-3xl font-bold mb-1" style={{ color: scoreCol }}>{sub.score}/10</h1>
          <p className="text-sm text-[#94A3B8] mb-6">Đúng {sub.correctCount}/{sub.totalQuestions} câu</p>
          <Link href="/bang-dieu-khien" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white text-sm font-semibold rounded-lg hover:bg-[#1D4ED8]">
            <ArrowLeft size={14} /> Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ExamTakingClient
      exam={{
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        durationMinutes: exam.durationMinutes,
        joinCode: exam.joinCode,
        questions: exam.questions.map((q: { id: string; text: string; options: string[]; order: number }) => ({
          id: q.id, text: q.text, options: q.options, order: q.order,
        })),
      }}
    />
  );
}
