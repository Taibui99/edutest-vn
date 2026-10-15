import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { isLegacyBrowser } from "@/lib/browser";

/* `auth` (NextAuth v5) nhận nhiều kiểu tham số qua overload; ở runtime
 * `auth(req, event)` với `req instanceof Request` chạy đúng luồng middleware
 * (đọc session + áp callback `authorized`). Ép kiểu về NextMiddleware để TS chọn
 * đúng chữ ký thay vì overload NextApiRequest. */
const authMiddleware = NextAuth(authConfig).auth as unknown as NextMiddleware;

/* Máy iOS cũ (Safari < 16.4) không chạy nổi React → phải chuyển sang hệ thống
 * thi HTML thuần ở /thi-cu. Chuyển hướng PHẢI là HTTP thật (307) tại middleware,
 * KHÔNG thể là redirect trong page component: `app/thi/[code]/loading.tsx` tạo
 * Suspense boundary → shell được stream đi trước → `redirect()` của page chỉ còn
 * là chuyển hướng phía client (RSC flight). Máy đích vốn không hydrate nổi React
 * nên nếu để ở page thì máy cũ bị kẹt nguyên ở trang hiện đại — đúng cái lỗi cần
 * sửa. Middleware trả 307 trước khi render nên trình duyệt tự đi tiếp, không cần JS.
 *
 * /thi-cu KHÔNG khớp matcher `/thi/:path*` (khác segment) → không có vòng lặp.
 * Preview của giáo viên (?preview) luôn ở bản đầy đủ nên bỏ qua. */
export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname.startsWith("/thi/")) {
    if (!searchParams.has("preview")) {
      const code = pathname.slice("/thi/".length);
      if (code && (searchParams.get("legacy") === "1" || isLegacyBrowser(req.headers.get("user-agent")))) {
        const url = req.nextUrl.clone();
        url.pathname = `/thi-cu/${code.toUpperCase()}`;
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
    // /thi không nằm trong phạm vi bảo vệ của auth middleware trước đây → giữ
    // nguyên hành vi: không chạy auth cho route thi (khách vào thi không cần login).
    return NextResponse.next();
  }

  return authMiddleware(req, event);
}

export const config = {
  matcher: ["/bang-dieu-khien/:path*", "/admin/:path*", "/dang-nhap", "/dang-ky", "/thi/:path*"],
};
