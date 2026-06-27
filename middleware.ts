import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/bang-dieu-khien/:path*", "/dang-nhap", "/dang-ky"],
};
