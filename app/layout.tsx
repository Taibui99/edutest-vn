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
  title: "A6Class Edu — Nền tảng học tập thông minh",
  description:
    "A6Class Edu giúp học sinh ôn thi hiệu quả và giáo viên tạo đề thi dễ dàng. Nền tảng EdTech hàng đầu Việt Nam.",
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
        {/* PRE-1: logic preloader chạy INLINE tại đây (không đặt trong component
            React). Bug iPhone: vòng lặp rAF trong useEffect chỉ chạy sau khi
            hydrate — iOS Safari hoãn rAF lúc đang nạp, và máy/mạng chậm thì
            hydrate rất muộn → overlay đứng ở "0%" rồi bị failsafe CSS 6s dọn đi.
            Ở đây bám `DOMContentLoaded` (nổ ngay sau khi HTML xong, không đợi
            bundle) và dùng `setInterval` (không bị iOS hoãn như rAF). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
try{
  var MIN=1100, CAP=3500, RAMP=900, MAX=88;
  var MSG=[[0,"Đang khởi tạo A6Class…"],[38,"Đang tải giao diện và chữ…"],[78,"Đang hoàn thiện…"],[100,"Sẵn sàng!"]];
  function start(){
    var el=document.getElementById("a6-preloader");
    if(!el){return;}
    if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){el.style.display="none";return;}
    var num=el.querySelector("[data-a6-pct]");
    var liquid=el.querySelector(".a6-pl-liquid");
    var status=el.querySelector(".a6-pl-status");
    var ready=document.readyState==="complete";
    var settled=false, timer=0;
    function render(v){
      v=Math.round(v);
      if(num){num.textContent=v;}
      if(liquid){liquid.style.height=v+"%";}
      if(status){var t=MSG[0][1];for(var i=0;i<MSG.length;i++){if(v>=MSG[i][0]){t=MSG[i][1];}}status.textContent=t;}
    }
    function finish(){
      if(settled){return;}
      settled=true;
      if(timer){clearInterval(timer);}
      render(100);
      el.setAttribute("data-burst","true");
      var root=document.documentElement;
      root.classList.add("a6-reveal");
      document.addEventListener("animationend",function(e){ if(e.animationName==="a6-pl-page-in"){root.classList.remove("a6-reveal");} });
      setTimeout(function(){root.classList.remove("a6-reveal");}, 1300);
    }
    window.addEventListener("load",function(){ready=true;});
    try{document.fonts&&document.fonts.ready&&document.fonts.ready.then(function(){ready=true;})["catch"](function(){});}catch(e){}
    window.setTimeout(function(){ready=true;}, CAP);
    var t0=performance.now();
    timer=window.setInterval(function(){
      if(settled){window.clearInterval(timer);return;}
      var elapsed=performance.now()-t0;
      if(ready&&elapsed>=MIN){window.clearInterval(timer);finish();return;}
      var p=Math.min(elapsed/RAMP,1);p=1-Math.pow(1-p,3);
      render(p*MAX);
    },50);
  }
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",start);}else{start();}
}catch(e){try{var x=document.getElementById("a6-preloader");if(x){x.style.display="none";}}catch(_){}}
})();`,
          }}
        />
        {/* PRE-1: preloader cần JS mới tắt được. Không có JS thì ẩn luôn,
            đừng để người dùng bị một lớp phủ trắng vĩnh viễn che mất trang.

            KHÔNG dùng cờ sessionStorage nữa: preloader phải hiện mỗi lần tải
            trang. Chuyển màn hình trong app thì không tải lại layout nên không
            cần preloader — lớp phủ của `PageTransition` lo phần đó. */}
        <noscript>
          <style>{"#a6-preloader{display:none!important}"}</style>
        </noscript>
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
              {/* PRE-2: PHẢI có component này thì React mới gọi
                  `document.startViewTransition()` khi đổi route. Chỉ bật cờ
                  `experimental.viewTransition` trong next.config.ts là không
                  đủ — đo bằng cách vá thẳng `document.startViewTransition`:
                  không bọc component thì số lần gọi đứng yên ở 0, trang đổi
                  tức thì, CSS trượt không có gì để áp dụng. */}
              <ViewTransition>{children}</ViewTransition>
            </MaintenanceGate>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}