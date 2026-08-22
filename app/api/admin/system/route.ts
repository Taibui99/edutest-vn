import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminAccess, sessionUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!isAdminAccess(sessionUser(session))) {
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

  checks.auth = {
    ok: true,
    detail: `Phiên hợp lệ · vai trò ${session.user.role}`,
  };

  checks.api = { ok: true, detail: "API server phản hồi bình thường" };

  checks.storage = { ok: true, detail: "Không sử dụng storage ngoài (dữ liệu trong DB)" };

  const [examCount, userCount, notifCount, settingCount, lastAi] = await Promise.all([
    prisma.exam.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.notification.count(),
    prisma.systemSetting.count(),
    prisma.aiImportLog.findFirst({ orderBy: { createdAt: "desc" }, select: { status: true, model: true, createdAt: true } }),
  ]);

  return NextResponse.json({
    checks,
    counts: { exams: examCount, users: userCount, notifications: notifCount, settings: settingCount },
    lastAiImport: lastAi,
    env: {
      nextAuthSecretSet: Boolean(process.env.AUTH_SECRET),
      geminiKeySet: Boolean(process.env.GEMINI_API_KEY),
      nodeEnv: process.env.NODE_ENV,
    },
    now: new Date().toISOString(),
  });
}