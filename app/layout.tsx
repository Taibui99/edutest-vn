import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import { getSetting } from "@/lib/settings";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { ThemeProvider } from "@/components/theme/theme-provider";

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
    <html lang="vi" className="h-full scroll-smooth antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("edutest-theme");var d=t==="dark"||t==="light"?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}})();`,
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
          <MaintenanceGate
            maintenanceOn={maintenance === "true"}
            isAdmin={session?.user?.role === "admin"}
          >
            {children}
          </MaintenanceGate>
        </ThemeProvider>
      </body>
    </html>
  );
}