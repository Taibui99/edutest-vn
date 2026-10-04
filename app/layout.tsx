import type { Metadata } from "next";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { getSetting } from "@/lib/settings";
import { MaintenanceGate } from "@/components/maintenance-gate";
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
      </head>
      <body className="min-h-full flex flex-col">
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
              {children}
            </MaintenanceGate>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}