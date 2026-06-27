"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  if (password.length < 6) {
    return { error: "Mật khẩu phải có ít nhất 6 ký tự." };
  }

  if (password !== confirmPassword) {
    return { error: "Mật khẩu xác nhận không khớp." };
  }

  if (!["teacher", "student"].includes(role)) {
    return { error: "Vai trò không hợp lệ." };
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
