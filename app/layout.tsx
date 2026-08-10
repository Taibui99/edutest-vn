import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduTest.vn — Nền tảng học tập thông minh",
  description:
    "EduTest giúp học sinh ôn thi hiệu quả và giáo viên tạo đề thi dễ dàng. Nền tảng EdTech hàng đầu Việt Nam.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full scroll-smooth antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
