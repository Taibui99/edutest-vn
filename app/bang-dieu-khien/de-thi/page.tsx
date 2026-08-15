import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Plus, FileText, Clock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getSubjectColor } from "@/lib/subject";
import { ExamListFilters } from "./exam-list-filters";

export const metadata: Metadata = { title: "Đề thi — EduTest" };

export default async function ExamListPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; status?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");

  const isTeacher = session.user.mode !== "student";

  if (isTeacher) {
    const { q, subject, status } = await searchParams;
    const allExams = await prisma.exam.findMany({
      where: { teacherId: session.user.id },
      select: { subject: true },
    });
    const subjects = Array.from(new Set(allExams.map((e) => e.subject))).sort();

    const exams = await prisma.exam.findMany({
      where: {
        teacherId: session.user.id,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(subject ? { subject } : {}),
        ...(status === "published" || status === "draft" ? { status } : {}),
      },
      include: {
        _count: { select: { questions: true, submissions: true } },
        submissions: { select: { score: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return (
      <div className="p-5 lg:p-8 max-w-5xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Đề thi</h1>
            <p className="text-sm text-[#64748B] mt-0.5">{exams.length} đề thi đã tạo</p>
          </div>
          <Link href="/bang-dieu-khien/tao-de-thi">
            <Button icon={<Plus size={16} />}>Tạo đề mới</Button>
          </Link>
        </div>

        <ExamListFilters
          subjects={subjects}
          initialQ={q || ""}
          initialSubject={subject || ""}
          initialStatus={status || ""}
        />

        {exams.length === 0 ? (
          <Card className="py-16">
            <EmptyState
              icon={<FileText />}
              title={q || subject || status ? "Không tìm thấy đề thi nào" : "Chưa có đề thi nào"}
              description={q || subject || status ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm" : "Tạo đề thi đầu tiên để chia sẻ với học sinh"}
              action={
                q || subject || status ? undefined : (
                  <Link href="/bang-dieu-khien/tao-de-thi">
                    <Button icon={<Plus size={16} />}>Tạo đề thi</Button>
                  </Link>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 motion-enter-stagger">
            {exams.map((exam: { id: string; title: string; subject: string; joinCode: string; status: string; durationMinutes: number; openAt: Date | null; closeAt: Date | null; createdAt: Date; _count: { questions: number; submissions: number }; submissions: { score: number }[] }) => {
              const c = getSubjectColor(exam.subject);
              const avgScore = exam.submissions.length > 0
                ? exam.submissions.reduce((s, sub) => s + sub.score, 0) / exam.submissions.length
                : null;
              const now = new Date();
              const schedule = exam.openAt || exam.closeAt
                ? exam.openAt && now < exam.openAt ? `Mở lúc ${exam.openAt.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}`
                  : exam.closeAt && now > exam.closeAt ? `Đóng lúc ${exam.closeAt.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}`
                    : exam.closeAt ? `Đóng lúc ${exam.closeAt.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}` : null
                : null;

              return (
                <Link key={exam.id} href={`/bang-dieu-khien/de-thi/${exam.id}`} className="min-w-0">
                  <Card hover className="p-0 overflow-hidden h-full">
                    <div className="h-1.5" style={{ background: c.text }} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0F172A] truncate">{exam.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: c.bg, color: c.text }}>
                              {exam.subject}
                            </span>
                          </div>
                        </div>
                        <Badge variant="primary">{exam.joinCode}</Badge>
                        {exam.status === "draft" && (
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-amber-100 text-amber-700">
                            Bản nháp
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#64748B]">
                        <span className="flex items-center gap-1"><FileText size={12} /> {exam._count.questions} câu</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {exam.durationMinutes} phút</span>
                        <span className="flex items-center gap-1"><Users size={12} /> {exam._count.submissions} bài nộp</span>
                      </div>
                      {schedule && (
                        <p className="mt-2 text-[11px] font-semibold text-[#D97706] flex items-center gap-1">
                          <Clock size={11} /> {schedule}
                        </p>
                      )}
                      {avgScore !== null && (
                        <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                          <span className="text-xs text-[#94A3B8]">Điểm trung bình</span>
                          <span className="text-sm font-bold text-[#2563EB]">{avgScore.toFixed(1)}/10</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Student view
  const submissions = await prisma.submission.findMany({
    where: { studentId: session.user.id },
    include: { exam: { select: { title: true, subject: true, durationMinutes: true, _count: { select: { questions: true } } } } },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Đề thi của tôi</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{submissions.length} bài đã làm</p>
        </div>
        <Link href="/vao-thi">
          <Button icon={<Plus size={16} />}>Vào thi bằng mã</Button>
        </Link>
      </div>

      {submissions.length === 0 ? (
        <Card className="py-16">
          <EmptyState
            icon={<FileText />}
            title="Chưa có bài thi nào"
            description="Nhập mã đề thi từ giáo viên để bắt đầu làm bài"
            action={<Link href="/vao-thi"><Button>Nhập mã thi</Button></Link>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {submissions.map((sub: typeof submissions[0]) => {
            const c = getSubjectColor(sub.exam.subject);
            const scoreVal = sub.score;
            const scoreCol = scoreVal >= 8 ? "#16A34A" : scoreVal >= 6.5 ? "#D97706" : "#DC2626";

            return (
              <Card key={sub.id} className="p-0 overflow-hidden">
                <div className="flex items-center gap-0">
                  <div className="w-1.5 self-stretch" style={{ background: c.text }} />
                  <div className="flex-1 p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#0F172A] truncate">{sub.exam.title}</p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        {sub.exam.subject} · {new Date(sub.submittedAt).toLocaleDateString("vi-VN")}
                        · {Math.floor(sub.durationSeconds / 60)}:{String(sub.durationSeconds % 60).padStart(2, "0")} phút làm bài
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold" style={{ color: scoreCol }}>{scoreVal}/10</p>
                      <p className="text-xs text-[#94A3B8]">{sub.correctCount}/{sub.totalQuestions} đúng</p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
