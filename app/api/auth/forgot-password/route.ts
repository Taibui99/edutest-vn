import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = rateLimit(`forgot:${clientIp(req)}`, 3, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Bạn đã yêu cầu quá nhiều lần. Thử lại sau ${rl.retryAfterSec} giây.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { email } = await req.json();
  const normalized = String(email || "").toLowerCase().trim();

  if (!normalized) {
    return NextResponse.json({ error: "Vui lòng nhập email" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    return NextResponse.json({ ok: true, found: false });
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const resetUrl = `${origin}/doi-mat-khau?token=${token}`;
  const mail = passwordResetEmail(user.name || "bạn", resetUrl);
  const result = await sendEmail({ to: user.email, subject: mail.subject, html: mail.html });

  await logAudit({
    actorId: user.id,
    type: "auth.forgot_password",
    message: `Yêu cầu đặt lại mật khẩu cho ${user.email} — email ${result.sent ? "đã gửi" : "KHÔNG gửi được"}`,
  });

  // Không bao giờ trả resetLink trong production — chỉ dùng để debug local.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json({
      ok: true,
      resetLink: `/doi-mat-khau?token=${token}`,
    });
  }

  return NextResponse.json({ ok: true, found: true });
}