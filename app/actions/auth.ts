"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut, auth } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encode, getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";

export type AuthFormState = {
  error?: string;
};

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Vui lòng nhập email và mật khẩu." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/bang-dieu-khien",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Email hoặc mật khẩu không đúng." };
      }
      return { error: "Đã xảy ra lỗi. Vui lòng thử lại." };
    }
    throw error;
  }

  return {};
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = (formData.get("fullName") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!fullName || !email || !role || !password) {
    return { error: "Vui lòng điền đầy đủ thông tin." };
  }

  const allowRegistration = await getSetting("allowRegistration", "true");
  if (allowRegistration !== "true") {
    return { error: "Hệ thống tạm thời đóng đăng ký mới. Vui lòng thử lại sau." };
  }

  if (password.length < 6) {
    return { error: "Mật khẩu phải có ít nhất 6 ký tự." };
  }

  if (password !== confirmPassword) {
    return { error: "Mật khẩu xác nhận không khớp." };
  }

  if (!["teacher", "student"].includes(role)) {
    if (role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin", deletedAt: null } });
      if (adminCount > 0) {
        return { error: "Vai trò không hợp lệ." };
      }
    } else {
      return { error: "Vai trò không hợp lệ." };
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return { error: "Email đã được sử dụng." };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name: fullName,
      password: hashedPassword,
      role,
    },
  });

  await logAudit({
    type: "user.register",
    message: `Tài khoản mới: ${fullName} (${email}, vai trò ${role})`,
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/bang-dieu-khien",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "Đăng ký thành công nhưng không thể đăng nhập tự động. Vui lòng thử đăng nhập.",
      };
    }
    throw error;
  }

  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function switchModeAction(formData: FormData) {
  const readValue = (name: string): string => {
    const direct = formData.get(name);
    if (typeof direct === "string") return direct;
    for (const key of formData.keys()) {
      if (key.endsWith(`_${name}`)) {
        const v = formData.get(key);
        if (typeof v === "string") return v;
      }
    }
    return "";
  };

  const target = readValue("mode");
  const redirectTo = readValue("redirectTo");

  const session = await auth();
  if (!session?.user) return;

  const role = session.user.role;
  const allowedModes = role === "admin"
    ? ["student", "teacher", "admin"]
    : ["student", "teacher"];
  if (!allowedModes.includes(target)) return;
  if (target === session.user.mode) {
    if (redirectTo.startsWith("/bang-dieu-khien") || redirectTo.startsWith("/admin")) {
      redirect(redirectTo);
    }
    return;
  }

  const cookieStore = await cookies();
  const cookieName = cookieStore
    .getAll()
    .map((c) => c.name)
    .find((n) => n.endsWith("session-token"));
  if (!cookieName) return;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return;

  const currentToken = await getToken({
    req: { headers: { cookie: cookieStore.toString() } },
    secret,
    salt: cookieName,
  });
  if (!currentToken) return;

  const newToken = await encode({
    token: { ...currentToken, mode: target },
    secret,
    salt: cookieName,
    maxAge: 60 * 60 * 24 * 30,
  });

  cookieStore.set(cookieName, newToken, {
    httpOnly: true,
    secure: cookieName.startsWith("__Secure"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  await logAudit({
    type: "user.switchMode",
    message: `${session.user.name ?? session.user.email} chuyển chế độ sang ${target}`,
  });

  if (redirectTo.startsWith("/bang-dieu-khien") || redirectTo.startsWith("/admin")) {
    redirect(redirectTo);
  }
}
