import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ background: "#F0EFFE", borderTop: "1px solid #E0DCFC" }}>
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-lg font-black">
              <span style={{ color: "#6C63FF" }}>Edu</span>
              <span style={{ color: "#FF6B6B" }}>Test</span>
              <span style={{ color: "#94A3B8", fontWeight: 600, fontSize: "0.85em" }}>.vn</span>
            </span>
            <p className="text-sm mt-1" style={{ color: "#64748B" }}>
              Dự án cá nhân — xây dựng để học tốt hơn 🎯
            </p>
          </div>
          <div className="flex items-center gap-5 text-sm" style={{ color: "#94A3B8" }}>
            <Link href="/dang-ky" className="hover:text-[#6C63FF] transition-colors font-medium">Đăng ký</Link>
            <Link href="/dang-nhap" className="hover:text-[#6C63FF] transition-colors font-medium">Đăng nhập</Link>
            <Link href="/vao-thi" className="hover:text-[#6C63FF] transition-colors font-medium">Vào thi</Link>
          </div>
        </div>
        <div className="mt-6 pt-6 text-center text-xs" style={{ borderTop: "1px solid #D4CFFC", color: "#94A3B8" }}>
          © {new Date().getFullYear()} EduTest.vn — Made with ❤️ for học sinh Việt Nam
        </div>
      </div>
    </footer>
  );
}
