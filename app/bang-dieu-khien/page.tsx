import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/app/components/logo";

export const metadata: Metadata = {
  title: "Bảng điều khiển — EduTest",
  description: "Quản lý đề thi và bài kiểm tra trên EduTest.",
};

const roleLabels: Record<string, string> = {
  teacher: "Giáo viên",
  student: "Học sinh",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/dang-nhap");
  }

  const roleLabel = roleLabels[session.user.role] ?? session.user.role;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-blue-200 px-5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-blue-600">Bảng điều khiển</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Xin chào, {session.user.name}!
          </h1>
          <p className="mt-2 text-slate-600">
            Bạn đang đăng nhập với vai trò{" "}
            <span className="font-semibold text-slate-900">{roleLabel}</span>.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {session.user.role === "teacher" ? (
              <>
                <DashboardCard
                  title="Tạo đề thi"
                  description="Soạn đề trắc nghiệm mới cho lớp học."
                />
                <DashboardCard
                  title="Quản lý lớp"
                  description="Theo dõi danh sách học sinh và bài nộp."
                />
                <DashboardCard
                  title="Báo cáo kết quả"
                  description="Xem thống kê điểm số theo từng bài kiểm tra."
                />
              </>
            ) : (
              <>
                <DashboardCard
                  title="Bài kiểm tra"
                  description="Xem danh sách bài kiểm tra được giao."
                />
                <DashboardCard
                  title="Lịch sử làm bài"
                  description="Theo dõi các bài đã hoàn thành."
                />
                <DashboardCard
                  title="Kết quả"
                  description="Xem điểm số và nhận xét từ giáo viên."
                />
              </>
            )}
          </div>

          <div className="mt-8 rounded-xl bg-blue-50 px-6 py-4">
            <p className="text-sm text-blue-800">
              Các tính năng chi tiết sẽ được bổ sung trong các phiên bản tiếp
              theo.{" "}
              <Link href="/" className="font-semibold underline">
                Quay về trang chủ
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
