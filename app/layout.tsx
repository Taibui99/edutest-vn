import type { Metadata } from "next";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { ViewTransition } from "react";
import "./globals.css";
import { auth } from "@/auth";
import { getSetting } from "@/lib/settings";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { Preloader } from "@/app/components/preloader";
import { PageTransition } from "@/app/components/page-transition";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Font tự host qua next/font — thay cho @import Google (chặn render, lộ
 * IP người dùng). `subsets: vietnamese` là bắt buộc, thiếu thì dấu tiếng
 * Việt rơi về font dự phòng.
 */
const body = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const heading = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduTest.vn — Nền tảng học tập thông minh",
  description:
    "EduTest giúp học sinh ôn thi hiệu quả và giáo viên tạo đề thi dễ dàng. Nền tảng EdTech hàng đầu Việt Nam.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let session: { user?: { role?: string | null } | null } | null = null;
  try {
    session = await auth();
  } catch {}
  const maintenance = await getSetting("maintenanceMode", "false");

  return (
    <html
      lang="vi"
      className={`${body.variable} ${heading.variable} h-full scroll-smooth antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.remove("dark")}catch(e){}})();`,
          }}
        />
        {/* PRE-1: preloader cần JS mới tắt được. Không có JS thì ẩn luôn,
            đừng để người dùng bị một lớp phủ trắng vĩnh viễn che mất trang.
            Script này chạy trước khi body vẽ: đã xem preloader trong phiên này
            thì đánh dấu để CSS ẩn ngay, không chớp sáng một khung hình.
            `?preload=1` để xem lại hiệu ứng. */}
        <noscript>
          <style>{"#a6-preloader{display:none!important}"}</style>
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(!/[?&]preload=1/.test(location.search)&&sessionStorage.getItem("a6-preloader-seen")==="1")document.documentElement.classList.add("a6-preloader-off")}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Preloader />
        <PageTransition />
        <a
          href="#main-content"
          className="skip-link"
        >
          Bỏ qua điều hướng
        </a>
        <ThemeProvider>
          <ToastProvider>
            <MaintenanceGate
              maintenanceOn={maintenance === "true"}
              isAdmin={session?.user?.role === "admin"}
            >
              {/* PRE-2: bọc ở layout vì app không có <ViewTransition> nào ở page
                  (lồng VT thì enter/exit của page im lặng không chạy). enter/exit
                  ở đây là của `children` — nó đổi theo từng lần điều hướng. */}
              <ViewTransition enter="page-reveal" exit="page-out">
                {children}
              </ViewTransition>
            </MaintenanceGate>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}