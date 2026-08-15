import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cho biết hệ thống đã có admin chưa (dùng cho nút bootstrap admin đầu tiên)
export async function GET() {
  const adminCount = await prisma.user.count({ where: { role: "admin", deletedAt: null } });
  return NextResponse.json({ hasAdmin: adminCount > 0 });
}