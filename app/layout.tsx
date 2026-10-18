import type { Metadata } from "next";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { ViewTransition } from "react";
import "./globals.css";
import { getSession } from "@/lib/session";
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
  const session = await getSession();
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

            PRE-4 (18/10/2026) — 2 lỗi đo được trên prod bằng Playwright:
            1) Chờ `DOMContentLoaded` mới bắt đầu → overlay hiện ra lúc HTML mới
               parse xong nhưng đứng yên "0%" hàng trăm mili-giây chờ sự kiện.
               GIỜ: MutationObserver bám ngay lúc `#a6-preloader` vừa vào DOM →
               hiện % ngay lập tức.
            2) React #418 (chuỗi giờ server UTC ≠ máy khách VN) làm React THAY
               node preloader giữa chừng → vòng lặp vẫn animate node đã gỡ khỏi
               DOM → overlay thật đứng 0% tới khi failsafe CSS 6s dọn ("đứng
               đơ rồi vào luôn", đo trên /truc-tiep). GIỜ: `start()` thấy node
               cũ đã `!isConnected` thì NHẬN node mới và GIỮ tiến trình (t0,
               % hiện tại) — ngoài ra #418 đã bị chặn gốc ở lib/time.ts.
               Lưới an toàn: soft-nav chèn preloader trùng thì ẩn (không animate),
               và `finish()` ẩn mọi node preloader còn sót — không bao giờ để
               lớp phủ treo che trang.
            SẴN sàng = `load` (CSS/font/chunk xong) + trần CAP theo tier — bỏ
            cách `readyState!=="loading"` (đúng ngay lúc DOMContentLoaded nên
            overlay là bấm giờ cố định, không phản ánh tải thật).

            PERF-1: script TỰ PHÂN LOẠI máy → gắn `a6-perf-low|mid|high` lên
            <html> để CSS/JS bật-tắt hiệu ứng nặng theo năng lực thiết bị. Thời
            gian preloader co theo tier (0.6–0.9s sau lúc node xuất hiện) và KHÔNG
            cộng dồn khi trang vốn đã chậm (nếu đã >2.6s thì chỉ nhấp 0.25s).
            Trần tuyệt đối ~2.2s + bùm 0.5s thay cho MIN cứng 5s trước đây. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
try{
  /* PERF-1: phân loại máy để CSS bật/tắt hiệu ứng nặng (xem globals.css). */
  var cores=navigator.hardwareConcurrency||4;
  var mem=navigator.deviceMemory||4;
  var conn=navigator.connection||{};
  var et=conn.effectiveType||"";
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var tier="mid";
  if(reduced||conn.saveData||/2g|3g/.test(et)||cores<=2||mem<=2){tier="low";}
  else if(cores>=8&&mem>=8){tier="high";}
  try{document.documentElement.classList.add("a6-perf-"+tier);}catch(e){}

  /* Thời gian preloader theo tier — tính TỪ LÚC NODE XUẤT HIỆN (t0),
     không chờ DOMContentLoaded nữa. */
  var MIN=600, CAP=1600, RAMP=600, MAX=92;
  if(tier==="low"){MIN=900;CAP=2200;RAMP=900;}
  else if(tier==="mid"){MIN=750;CAP=1900;RAMP=750;}

  var MSG=[[0,"Đang khởi tạo A6Class…"],[45,"Đang tải giao diện và chữ…"],[80,"Đang hoàn thiện…"],[100,"Sẵn sàng!"]];
  /* Trạng thái chung cho TOÀN BỘ vòng đời: có thể có nhiều node preloader
     theo thời gian (node đầu do HTML sinh, node React thay lúc hydration,
     node soft-nav tái tạo) — vòng lặp luôn bám node cur đang kết nối. */
  var cur=null, last=0, t0=0, ready=false, started=false, settled=false, raf=0, timer=0;

  function nodes(el){
    if(!el.__n){el.__n={num:el.querySelector("[data-a6-pct]"),liquid:el.querySelector(".a6-pl-liquid"),status:el.querySelector(".a6-pl-status")};}
    return el.__n;
  }
  /* Cột nước dùng transform translateY (GPU, KHÔNG layout) thay vì height
     — sửa jank: đổi height mỗi khung hình bắt trình duyệt tính lại layout toàn
     overlay. Node được cache để khỏi querySelector mỗi khung. */
  function render(el,v){
    v=Math.round(v); if(v<0){v=0;} if(v>100){v=100;}
    last=v;
    var n=nodes(el);
    if(n.num){n.num.textContent=v;}
    if(n.liquid){n.liquid.style.transform="translateY("+(100-v)+"%)";}
    if(n.status){var t=MSG[0][1];for(var i=0;i<MSG.length;i++){if(v>=MSG[i][0]){t=MSG[i][1];}}n.status.textContent=t;}
  }
  function tick(){
    if(settled||!cur){return;}
    var elapsed=performance.now()-t0;
    if(ready&&elapsed>=MIN){finish();return;}
    var p=Math.min(elapsed/RAMP,1);p=1-Math.pow(1-p,3);
    render(cur,p*MAX);
  }
  function step(now){
    if(settled){return;}
    var elapsed=now-t0;
    if(ready&&elapsed>=MIN){finish();return;}
    var p=Math.min(elapsed/RAMP,1);p=1-Math.pow(1-p,3);
    if(cur){render(cur,p*MAX);}
    raf=window.requestAnimationFrame(step);
  }
  function finish(){
    if(settled){return;}
    settled=true;
    if(timer){window.clearInterval(timer);timer=0;}
    if(raf){window.cancelAnimationFrame(raf);raf=0;}
    var el=cur;
    if(el){
      render(el,100);
      el.setAttribute("data-burst","true");
      /* Gỡ hẳn overlay khỏi DOM sau khi bùm xong (600ms). Trước đây là component
         React tự unmount; giờ markup là HTML thô nên phải tự dọn — để lại một
         lớp position:fixed z-9999 phủ toàn trang là mối nguy chặn click/cuộn. */
      setTimeout(function(){try{if(el&&el.parentNode){el.parentNode.removeChild(el);}}catch(_){}}, 600);
    }
    /* Lưới an toàn: che mọi node preloader còn sót (soft-nav chèn trùng lúc
       animation chạy) — không bao giờ để lớp phủ treo che trang. */
    try{
      var all=document.querySelectorAll("#a6-preloader");
      for(var i=0;i<all.length;i++){if(all[i]!==el){all[i].style.display="none";}}
    }catch(_){}
    var root=document.documentElement;
    root.classList.add("a6-reveal");
    document.addEventListener("animationend",function(e){ if(e.animationName==="a6-pl-page-in"){root.classList.remove("a6-reveal");} });
    setTimeout(function(){root.classList.remove("a6-reveal");}, 1100);
  }
  function start(el){
    if(el.__a6){return;}
    el.__a6=1;
    /* Giảm chuyển động: ẩn luôn, không animate, không hẹn giờ. */
    if(reduced){el.style.display="none";return;}
    if(settled){el.style.display="none";return;}
    if(cur&&cur!==el){
      /* Node khác đang animate && còn trong DOM → node mới là bản chèn trùng
         (soft-nav tái tạo markup layout) → ẩn, để PageTransition lo. */
      if(cur.isConnected){el.style.display="none";return;}
      /* Node cũ ĐÃ bị gỡ (React thay node lúc hydration — lệch #418) → nhận
         node mới, GIỮ tiến trình: t0/% không đổi, chỉ đổi đích render. */
      cur=el;
      render(el,last);
      return;
    }
    cur=el;
    if(!started){
      started=true;
      /* Trang vốn đã chậm (mạng yếu/cold start): không cộng thêm thời gian chờ,
         chỉ nhấp overlay rồi mở ngay. */
      if(performance.now()>2600){MIN=250;RAMP=250;CAP=Math.min(CAP,900);}
      t0=performance.now();
      /* SẴN = load của toàn trang (CSS render-blocking + font + chunk xong).
         Không dùng readyState!=="loading" vì nó đúng ngay lúc DOMContentLoaded
         → overlay chỉ là bấm giờ cố định. Trần CAP để không bị treo nếu có
         tài nguyên treo. */
      if(document.readyState==="complete"){ready=true;}
      window.addEventListener("load",function(){ready=true;});
      window.setTimeout(function(){ready=true;}, CAP);
      /* Vòng mượt: rAF cho 60fps, nhưng kèm WATCHDOG setInterval 400ms để vẫn
         kết thúc nếu rAF bị hoãn/treo (tab nền, máy yếu) — vì iOS Safari có
         thể hoãn rAF lúc nạp. */
      if(window.requestAnimationFrame){raf=window.requestAnimationFrame(step);}
      timer=window.setInterval(tick,400);
    }
    render(el,last);
  }
  /* Chạy NGAY khi node vào DOM (không chờ DOMContentLoaded) → overlay hiện %,
     không "đứng 0%" chờ sự kiện sau. */
  function onAdded(n){
    if(!n||n.nodeType!==1){return;}
    var t=(n.id==="a6-preloader")?n:(n.querySelector?n.querySelector("#a6-preloader"):null);
    if(t){start(t);}
  }
  try{
    var mo=new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var adds=muts[i].addedNodes;
        for(var j=0;j<adds.length;j++){onAdded(adds[j]);}
      }
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }catch(e){}
  var el0=document.getElementById("a6-preloader");
  if(el0){start(el0);}
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
