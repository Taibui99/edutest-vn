import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
            Nền tảng kiểm tra trực tuyến hàng đầu
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Kiểm tra trực tuyến{" "}
            <span className="text-blue-600">nhanh chóng & chính xác</span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">
            EduTest giúp giáo viên tạo đề thi, học sinh làm bài trực tuyến và
            chấm điểm tự động — tiết kiệm thời gian, nâng cao chất lượng giảng
            dạy.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dang-ky"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-8 text-base font-semibold text-white shadow-md transition-colors hover:bg-blue-700 sm:w-auto"
            >
              Bắt đầu miễn phí
            </Link>
            <Link
              href="#tinh-nang"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-8 text-base font-semibold text-blue-700 transition-colors hover:bg-blue-50 sm:w-auto"
            >
              Tìm hiểu thêm
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-6 border-t border-blue-100 pt-10">
            <div>
              <p className="text-3xl font-bold text-blue-600">10K+</p>
              <p className="mt-1 text-sm text-slate-500">Giáo viên tin dùng</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">500K+</p>
              <p className="mt-1 text-sm text-slate-500">Bài kiểm tra</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">2M+</p>
              <p className="mt-1 text-sm text-slate-500">Lượt làm bài</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
