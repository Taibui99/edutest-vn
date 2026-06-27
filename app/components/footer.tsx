import Link from "next/link";

const footerLinks = {
  sanPham: [
    { label: "Tạo đề thi", href: "#tinh-nang" },
    { label: "Làm bài trực tuyến", href: "#tinh-nang" },
    { label: "Chấm điểm tự động", href: "#tinh-nang" },
  ],
  hoTro: [
    { label: "Hướng dẫn sử dụng", href: "#huong-dan" },
    { label: "Câu hỏi thường gặp", href: "#huong-dan" },
    { label: "Liên hệ", href: "#lien-he" },
  ],
};

export function Footer() {
  return (
    <footer id="lien-he" className="border-t border-blue-100 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold text-blue-900">EduTest</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
              Nền tảng kiểm tra trực tuyến dành cho giáo viên và học sinh Việt
              Nam. Đơn giản, hiệu quả, dễ sử dụng.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Sản phẩm</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.sanPham.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-600 transition-colors hover:text-blue-600"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Hỗ trợ</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.hoTro.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-600 transition-colors hover:text-blue-600"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} EduTest. Bản quyền thuộc về EduTest
            Việt Nam.
          </p>
          <div className="flex gap-6">
            <Link
              href="#"
              className="text-sm text-slate-500 transition-colors hover:text-blue-600"
            >
              Điều khoản
            </Link>
            <Link
              href="#"
              className="text-sm text-slate-500 transition-colors hover:text-blue-600"
            >
              Chính sách bảo mật
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
