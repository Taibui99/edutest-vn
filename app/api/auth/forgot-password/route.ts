import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const normalized = String(email || "").toLowerCase().trim();

  if (!normalized) {
    return NextResponse.json({ error: "Vui lòng nhập email" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  await logAudit({
    actorId: user.id,
    type: "auth.forgot_password",
    message: `Yêu cầu đặt lại mật khẩu cho ${user.email}`,
  });

  const expose = await prisma.systemSetting
    .findUnique({ where: { key: "exposeResetLink" } })
    .then((s) => s?.value === "true")
    .catch(() => false);

  const resetLink = `/doi-mat-khau?token=${token}`;

  return NextResponse.json({
    ok: true,
    resetLink: expose ? resetLink : null,
  });
}