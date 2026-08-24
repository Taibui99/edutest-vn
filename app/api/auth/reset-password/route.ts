import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = rateLimit(`reset:${clientIp(req)}`, 10, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Quá nhiều lần thử. Thử lại sau ${rl.retryAfterSec} giây.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { token, password } = await req.json();
  const normalizedToken = String(token || "");
  const newPassword = String(password || "");

  if (!normalizedToken) {
    return NextResponse.json({ error: "Token không hợp lệ" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { resetToken: normalizedToken } });
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
  });

  await logAudit({
    actorId: user.id,
    type: "auth.reset_password",
    message: `Đặt lại mật khẩu cho ${user.email}`,
  });

  return NextResponse.json({ ok: true });
}