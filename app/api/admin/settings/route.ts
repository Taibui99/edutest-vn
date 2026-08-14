import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const ALLOWED_KEYS = new Set([
  "siteName",
  "siteDescription",
  "allowGuestAttempts",
  "maintenanceMode",
  "exposeResetLink",
  "allowRegistration",
  "enableAiImport",
]);

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.systemSetting.findMany();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key, value } = await req.json();
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Key không hợp lệ" }, { status: 400 });
  }

  const setting = await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });

  await logAudit({
    actorId: session.user.id,
    type: "admin.setting_update",
    message: `Admin ${session.user.email} cập nhật cài đặt ${key}`,
    meta: { value: String(value) },
  });

  return NextResponse.json({ setting });
}