import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = body.fullName?.trim();
    const email = body.email?.toLowerCase().trim();
    const role = body.role;
    const password = body.password;

    if (!fullName || !email || !role || !password) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ thông tin." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu phải có ít nhất 6 ký tự." },
        { status: 400 },
      );
    }

    if (!["teacher", "student"].includes(role)) {
      return NextResponse.json(
        { error: "Vai trò không hợp lệ." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email đã được sử dụng." },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: fullName,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Đăng ký thành công.", user },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
