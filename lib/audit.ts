import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  actorId?: string | null;
  type: string;
  message: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.appLog.create({
      data: {
        actorId: params.actorId ?? null,
        type: params.type,
        message: params.message,
        meta: (params.meta ?? undefined) as object | undefined,
      },
    });
  } catch {
    // Audit không được phép làm hỏng luồng chính
  }
}
