import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Cho biết hệ thống đã có admin chưa (dùng cho nút bootstrap admin đầu tiên)
export async function GET(req: Request) {
  const rl = rateLimit(`admin-status:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const adminCount = await prisma.user.count({ where: { role: "admin", deletedAt: null } });
  return NextResponse.json({ hasAdmin: adminCount > 0 });
}