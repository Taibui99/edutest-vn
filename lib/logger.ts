import { prisma } from "@/lib/prisma";

export async function logError(context: string, err: unknown, meta?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, err);
  try {
    await prisma.appLog.create({
      data: {
        type: "error",
        message: `${context}: ${message.slice(0, 500)}`,
        meta: meta ? { ...meta, at: new Date().toISOString() } : { at: new Date().toISOString() },
      },
    });
  } catch {
    // không làm crash request khi log lỗi
  }
}