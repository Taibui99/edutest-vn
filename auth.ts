import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
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
});
