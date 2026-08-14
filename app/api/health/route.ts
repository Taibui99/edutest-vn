import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "down", error: err instanceof Error ? err.message.slice(0, 200) : "unknown" },
      { status: 503 },
    );
  }
}