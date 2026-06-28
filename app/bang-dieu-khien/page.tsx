import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/app/components/logo";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Bảng điều khiển — EduTest",
  description: "Quản lý đề thi và bài kiểm tra trên EduTest.",
};

const roleLabels: Record<string, string> = {
  teacher: "Giáo viên",
  student: "Học sinh",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  const params = await searchParams;
  const roleLabel = roleLabels[session.user.role] ?? session.user.role;
  const isTeacher = session.user.role === "teacher";
  const teacherExams = isTeacher
    ? await prisma.exam.findMany({
        where: { teacherId: session.user.id },
        include: {
          _count: {
            select: {
              questions: true,
              submissions: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const studentSubmissions = !isTeacher
    ? await prisma.submission.findMany({
        where: { studentId: session.user.id },
        include: {
          exam: true,
        },
        orderBy: { submittedAt: "desc" },
      })
    : [];
  const averageScore =
    studentSubmissions.length > 0
      ? (
          studentSubmissions.reduce((sum, submission) => sum + submission.score, 0) /
          studentSubmissions.length
        ).toFixed(1)
      : "0";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-blue-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              👋 {session.user.name} &middot;{" "}
              <span className={`font-semibold ${isTeacher ? "text-blue-600" : "text-green-600"}`}>
                {roleLabel}
              </span>
            </span>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex h-9 items-center justify-center rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50">
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {params.created && (
          <div className="mb-6 rounded-2xl border border-green-100 bg-green-50 p-5 text-green-900">
            <p className="text-sm font-semibold">Đã xuất bản đề thi</p>
            <p className="mt-1 text-sm">
              Mã tham gia: <span className="font-bold tracking-[0.2em]">{params.created}</span>
            </p>
          </div>
        )}

        {/* Welcome */}
        <div className={`rounded-2xl p-8 mb-8 text-white ${isTeacher ? "bg-gradient-to-r from-blue-600 to-blue-700" : "bg-gradient-to-r from-green-500 to-green-600"}`}>
          <p className="text-sm font-medium opacity-80 mb-1">{isTeacher ? "🎓 Giáo viên" : "📚 Học sinh"}</p>
          <h1 className="text-3xl font-bold">Xin chào, {session.user.name}!</h1>
          <p className="mt-2 opacity-80 text-sm">
            {isTeacher
              ? "Quản lý đề thi, lớp học và theo dõi kết quả học sinh."
              : "Xem bài kiểm tra, làm bài và theo dõi kết quả của bạn."}
          </p>
        </div>

        {isTeacher ? (
          <>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Công cụ giáo viên</h2>
            <div className="grid gap-4 sm:grid-cols-3 mb-8">
              <DashboardCard
                icon="📝"
                title="Tạo đề thi"
                description="Soạn đề trắc nghiệm mới cho lớp học."
                color="blue"
                href="/bang-dieu-khien/tao-de-thi"
              />
              <DashboardCard
                icon="👥"
                title="Quản lý lớp"
                description="Theo dõi danh sách học sinh và bài nộp."
                color="blue"
                href="/bang-dieu-khien/quan-ly-lop"
                badge="Sắp có"
              />
              <DashboardCard
                icon="📊"
                title="Báo cáo kết quả"
                description="Xem thống kê điểm số theo từng bài kiểm tra."
                color="blue"
                href="/bang-dieu-khien/bao-cao"
                badge="Sắp có"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-3">📈 Thống kê nhanh</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{teacherExams.length}</div>
                    <div className="text-xs text-slate-500 mt-1">Đề thi đã tạo</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-xs text-slate-500 mt-1">Học sinh</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      {teacherExams.reduce((sum, exam) => sum + exam._count.submissions, 0)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Bài đã nộp</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">0</div>
                    <div className="text-xs text-slate-500 mt-1">Điểm TB</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-3">🕐 Hoạt động gần đây</h3>
                <div className="space-y-3">
                  {teacherExams.slice(0, 3).map((exam) => (
                    <div key={exam.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">{exam.title}</p>
                        <span className="text-xs font-bold text-blue-600">{exam.joinCode}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {exam._count.questions} câu · {exam._count.submissions} bài nộp
                      </p>
                    </div>
                  ))}
                  {teacherExams.length === 0 && (
                    <div className="text-sm text-slate-500 text-center py-6">Chưa có hoạt động nào</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold text-slate-800">Đề thi đã xuất bản</h3>
                <Link href="/bang-dieu-khien/tao-de-thi" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Tạo đề mới
                </Link>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                {teacherExams.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {teacherExams.map((exam) => (
                      <div key={exam.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <h4 className="font-semibold text-slate-900">{exam.title}</h4>
                          <p className="mt-1 text-sm text-slate-500">
                            {exam.subject} · {exam.durationMinutes} phút · {exam._count.questions} câu ·{" "}
                            {exam._count.submissions} bài nộp
                          </p>
                        </div>
                        <div className="rounded-lg bg-blue-50 px-4 py-2 text-center">
                          <p className="text-xs text-blue-500">Mã tham gia</p>
                          <p className="font-bold tracking-[0.2em] text-blue-700">{exam.joinCode}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-slate-500">Chưa có đề thi nào.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Học tập của bạn</h2>
            <div className="grid gap-4 sm:grid-cols-3 mb-8">
              <DashboardCard
                icon="📋"
                title="Vào thi bằng mã"
                description="Nhập mã giáo viên cung cấp để bắt đầu làm bài."
                color="green"
                href="/vao-thi"
              />
              <DashboardCard
                icon="📖"
                title="Lịch sử làm bài"
                description="Theo dõi các bài đã hoàn thành."
                color="green"
                href="/bang-dieu-khien/lich-su"
                badge="Sắp có"
              />
              <DashboardCard
                icon="🏆"
                title="Kết quả"
                description="Xem điểm số và nhận xét từ giáo viên."
                color="green"
                href="/bang-dieu-khien/ket-qua"
                badge="Sắp có"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-3">📊 Kết quả của tôi</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{studentSubmissions.length}</div>
                    <div className="text-xs text-slate-500 mt-1">Bài đã làm</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{averageScore}</div>
                    <div className="text-xs text-slate-500 mt-1">Điểm TB</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">0</div>
                    <div className="text-xs text-slate-500 mt-1">Bài chờ làm</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {studentSubmissions.length > 0
                        ? Math.max(...studentSubmissions.map((submission) => submission.score)).toFixed(1)
                        : "0"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Điểm cao nhất</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-3">📅 Bài sắp đến hạn</h3>
                <div className="text-sm text-slate-500 text-center py-6">
                  Nhập mã tham gia để làm bài kiểm tra mới.
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800">Lịch sử làm bài</h3>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                {studentSubmissions.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {studentSubmissions.map((submission) => (
                      <div key={submission.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <h4 className="font-semibold text-slate-900">{submission.exam.title}</h4>
                          <p className="mt-1 text-sm text-slate-500">
                            {submission.exam.subject} · Nộp ngày{" "}
                            {submission.submittedAt.toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        <div className="rounded-lg bg-green-50 px-4 py-2 text-center">
                          <p className="text-xs text-green-600">Điểm</p>
                          <p className="font-bold text-green-700">{submission.score}/10</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-slate-500">Bạn chưa nộp bài nào.</div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function DashboardCard({
  icon, title, description, color, href, badge,
}: {
  icon: string;
  title: string;
  description: string;
  color: "blue" | "green";
  href: string;
  badge?: string;
}) {
  const colors = {
    blue: "hover:border-blue-300 hover:bg-blue-50",
    green: "hover:border-green-300 hover:bg-green-50",
  };
  return (
    <Link href={href} className={`rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all ${colors[color]} block`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {badge && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </Link>
  );
}
