import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { defaultModeByRole } from "@/lib/access";
import { logAudit } from "@/lib/audit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
          return null;
        }

        // Rate limit per-IP: 20 attempts per 5 min (brute-force across many emails)
        const ip = req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const ipRl = rateLimit(`login-ip:${ip}`, 20, 5 * 60_000);
        if (!ipRl.ok) {
          return null;
        }

        const emailKey = email.toLowerCase().trim();
        // Chỉ đếm lần đăng nhập THẤT BẠI — login thành công không bị giới hạn.
        const rl = rateLimit(`login-fail:${emailKey}`, 10, 5 * 60_000);
        if (!rl.ok) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: emailKey },
        });

        if (!user) {
          return null;
        }

        if (user.isBlocked) {
          return null;
        }

        if (user.deletedAt) {
          return null;
        }

        // User chỉ đăng nhập bằng Google (không có mật khẩu) — chặn đăng nhập bằng mật khẩu
        if (!user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        resetRateLimit(`login-fail:${emailKey}`);

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    signIn: async ({ account, profile }) => {
      if (account?.provider !== "google") return true;

      if (profile?.email_verified === false) return false;

      const email = (profile?.email ?? "").toLowerCase().trim();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        if (existing.isBlocked || existing.deletedAt) return false;
        return true;
      }

      // Tạo tài khoản học sinh mới từ Google (password rỗng — chỉ đăng nhập qua OAuth)
      await prisma.user.create({
        data: {
          email,
          name: (profile?.name as string)?.slice(0, 100) || email.split("@")[0],
          password: "",
          role: "student",
          avatarUrl: (profile?.picture as string) || null,
        },
      });

      await logAudit({
        type: "user.register",
        message: `Tài khoản mới qua Google: ${email}`,
      });

      return true;
    },
    jwt: async ({ token, user, account }) => {
      if (user) {
        if (account?.provider === "google") {
          const email = (user.email ?? "").toLowerCase().trim();
          if (email) {
            const dbUser = await prisma.user.findUnique({ where: { email } });
            if (dbUser) {
              token.id = dbUser.id;
              token.role = dbUser.role;
            }
          }
        } else {
          token.id = user.id ?? "";
          token.role = user.role;
        }
      }
      if (!token.mode) {
        token.mode = defaultModeByRole(token.role as string);
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.mode = token.mode as string;
      }
      return session;
    },
  },
});
