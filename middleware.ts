import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/bang-dieu-khien") {
    const created = request.nextUrl.searchParams.get("created");
    if (created) {
      const target = new URL(`/bang-dieu-khien/chia-se-de/${encodeURIComponent(created)}`, request.url);
      return NextResponse.redirect(target);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/bang-dieu-khien"],
};
