import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true };
  } catch (e) {
    checks.db = { ok: false, detail: String(e) };
  }

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/", {
      signal: AbortSignal.timeout(5000),
    });
    checks.gemini = { ok: res.ok || res.status === 404, detail: `HTTP ${res.status}` };
  } catch (e) {
    checks.gemini = { ok: false, detail: String(e) };
  }

  const [examCount, userCount, notifCount, settingCount] = await Promise.all([
    prisma.exam.count(),
    prisma.user.count(),
    prisma.notification.count(),
    prisma.systemSetting.count(),
  ]);

  return NextResponse.json({
    checks,
    counts: { exams: examCount, users: userCount, notifications: notifCount, settings: settingCount },
    env: {
      nextAuthSecretSet: Boolean(process.env.AUTH_SECRET),
      geminiKeySet: Boolean(process.env.GEMINI_API_KEY),
      nodeEnv: process.env.NODE_ENV,
    },
    now: new Date().toISOString(),
  });
}