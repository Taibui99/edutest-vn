import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/dang-nhap",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = nextUrl.pathname.startsWith("/bang-dieu-khien");
      const isAuthPage =
        nextUrl.pathname.startsWith("/dang-nhap") ||
        nextUrl.pathname.startsWith("/dang-ky");

      if (isProtected && !isLoggedIn) {
        return false;
      }

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/bang-dieu-khien", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? "";
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
