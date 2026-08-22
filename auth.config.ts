import type { NextAuthConfig } from "next-auth";
import { effectiveMode, defaultModeByRole } from "@/lib/access";

const STUDENT_MODE_ROUTES = ["/bang-dieu-khien/hoc-tap", "/bang-dieu-khien/tien-do"];

const TEACHER_MODE_ROUTES = [
  "/bang-dieu-khien/tao-de-thi",
  "/bang-dieu-khien/hoc-sinh",
  "/bang-dieu-khien/ngan-hang",
  "/bang-dieu-khien/thong-ke",
  "/bang-dieu-khien/chia-se-de",
];

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/dang-nhap",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isProtected =
        pathname.startsWith("/bang-dieu-khien") ||
        pathname.startsWith("/admin");
      const isAuthPage =
        pathname.startsWith("/dang-nhap") ||
        pathname.startsWith("/dang-ky");

      if (isProtected && !isLoggedIn) {
        return false;
      }

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/bang-dieu-khien", nextUrl));
      }

      if (isLoggedIn) {
        // Token cũ trước G6 thiếu claim mode → suy ra mặc định theo role
        const mode = effectiveMode(auth.user);

        if (pathname.startsWith("/admin")) {
          if (mode !== "admin") {
            return Response.redirect(new URL("/bang-dieu-khien", nextUrl));
          }
          return true;
        }

        if (mode === "student") {
          if (TEACHER_MODE_ROUTES.some((r) => pathname.startsWith(r))) {
            return Response.redirect(new URL("/bang-dieu-khien", nextUrl));
          }
        }

        if (mode === "teacher") {
          if (STUDENT_MODE_ROUTES.some((r) => pathname.startsWith(r))) {
            return Response.redirect(new URL("/bang-dieu-khien", nextUrl));
          }
        }
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? "";
        token.role = user.role;
      }
      if (!token.mode) {
        // Token cũ trước G6 thiếu claim mode → bổ sung theo role
        token.mode = defaultModeByRole(token.role as string);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.mode = token.mode as string;
      }
      return session;
    },
  },
};