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
  // iOS Safari tự biến số điện thoại/email/ngày trong nội dung thành link →
  // DOM khác HTML server → lệch hydration (React #418). Vô hiệu hoá auto-detect.
  other: {
    "format-detection": "telephone=no, date=no, email=no, address=no",
  },
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
            hydrate rất muộn → overlay đứng ở "0%" rồi bị failsafe CSS dọn đi.
            Ở đây bám `DOMContentLoaded` (nổ ngay sau khi HTML xong, không đợi
            bundle). Vòng chạy bằng rAF (mượt 60fps) + WATCHDOG setInterval 400ms
            (vẫn kết thúc dù rAF bị iOS hoãn). Tối thiểu MIN=5s, trần CAP≈5.6s. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
try{
  var MIN=5000, CAP=5600, RAMP=4300, MAX=92;
  var MSG=[[0,"Đang khởi tạo A6Class…"],[45,"Đang tải giao diện và chữ…"],[80,"Đang hoàn thiện…"],[100,"Sẵn sàng!"]];
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var OBS_AFTER = 0;
  function nodes(el){
    if(!el.__n){el.__n={num:el.querySelector("[data-a6-pct]"),liquid:el.querySelector(".a6-pl-liquid"),status:el.querySelector(".a6-pl-status")};}
    return el.__n;
  }
  /* Cột nước dùng transform translateY (GPU, KHÔNG layout) thay vì height
     — sửa jank: đổi height mỗi khung hình bắt trình duyệt tính lại layout toàn
     overlay. Node được cache để khỏi querySelector mỗi khung. */
  function render(el,v){
    v=Math.round(v); if(v<0){v=0;} if(v>100){v=100;}
    var n=nodes(el);
    if(n.num){n.num.textContent=v;}
    if(n.liquid){n.liquid.style.transform="translateY("+(100-v)+"%)";}
    if(n.status){var t=MSG[0][1];for(var i=0;i<MSG.length;i++){if(v>=MSG[i][0]){t=MSG[i][1];}}n.status.textContent=t;}
  }
  function run(el){
    if(el.__a6){return;}
    el.__a6=1;
    if(reduced){el.style.display="none";return;}
    var ready=document.readyState==="complete";
    var settled=false, timer=0, raf=0;
    function finish(){
      if(settled){return;}
      settled=true;
      if(timer){clearInterval(timer);}
      if(raf){cancelAnimationFrame(raf);}
      render(el,100);
      el.setAttribute("data-burst","true");
      var root=document.documentElement;
      root.classList.add("a6-reveal");
      document.addEventListener("animationend",function(e){ if(e.animationName==="a6-pl-page-in"){root.classList.remove("a6-reveal");} });
      setTimeout(function(){root.classList.remove("a6-reveal");}, 1300);
      /* Gỡ hẳn overlay khỏi DOM sau khi bùm xong (650ms). Trước đây là component
         React tự unmount; giờ markup là HTML thô nên phải tự dọn — để lại một
         lớp position:fixed z-9999 phủ toàn trang là mối nguy chặn click/cuộn. */
      setTimeout(function(){try{if(el&&el.parentNode){el.parentNode.removeChild(el);}}catch(_){}}, 760);
    }
    window.addEventListener("load",function(){ready=true;});
    try{document.fonts&&document.fonts.ready&&document.fonts.ready.then(function(){ready=true;})["catch"](function(){});}catch(e){}
    window.setTimeout(function(){ready=true;}, CAP);
    /* Vòng mượt: rAF cho 60fps (thay setInterval 50ms = 20fps thấy "khựng"),
       nhưng kèm WATCHDOG setInterval 400ms để vẫn kết thúc nếu rAF bị hoãn/treo
       (tab nền, máy yếu) — vì iOS Safari có thể hoãn rAF lúc nạp. */
    var t0=performance.now();
    function step(now){
      if(settled){return;}
      var elapsed=now-t0;
      if(ready&&elapsed>=MIN){finish();return;}
      var p=Math.min(elapsed/RAMP,1);p=1-Math.pow(1-p,3);
      render(el,p*MAX);
      raf=window.requestAnimationFrame(step);
    }
    if(window.requestAnimationFrame){raf=window.requestAnimationFrame(step);}
    timer=window.setInterval(function(){
      if(settled){window.clearInterval(timer);return;}
      var elapsed=performance.now()-t0;
      if(ready&&elapsed>=MIN){finish();return;}
      var p=Math.min(elapsed/RAMP,1);p=1-Math.pow(1-p,3);
      render(el,p*MAX);
    },400);
  }
  /* Bug "vòng lặp nhập tên" (khách trên iPhone): sau khi khách bấm "Bắt đầu làm
     bài", client gọi router.refresh() (soft navigation). React chèn LẠI markup
     preloader (HTML thô, là một phần cây layout) nhưng <script> inline trong
     <head> KHÔNG chạy lại khi soft-navigate → overlay mới đứng nguyên ở 0%,
     che kín màn hình. Quan sát DOM: preloader nào xuất hiện SAU khi trang đã
     tải (ngoài cửa sổ nạp đầu) là do soft-nav tái tạo → ẩn ngay, không animate
     (soft-nav vốn do PageTransition lo, không cần preloader). */
  function watch(){
    try{
      var mo=new MutationObserver(function(muts){
        if(performance.now()<OBS_AFTER){return;}
        for(var i=0;i<muts.length;i++){
          var adds=muts[i].addedNodes;
          for(var j=0;j<adds.length;j++){
            var n=adds[j];
            if(n&&n.nodeType===1){
              var t=(n.id==="a6-preloader")?n:(n.querySelector?n.querySelector("#a6-preloader"):null);
              if(t&&!t.__a6){t.__a6=1;t.style.display="none";}
            }
          }
        }
      });
      mo.observe(document.documentElement,{childList:true,subtree:true});
    }catch(e){}
  }
  function boot(){
    OBS_AFTER = performance.now()+1800;
    var el=document.getElementById("a6-preloader");
    if(el){run(el);}
    watch();
  }
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
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