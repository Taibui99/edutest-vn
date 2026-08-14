import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { examId, type, description } = await req.json();

  if (!type || !description || !String(description).trim()) {
    return NextResponse.json({ error: "Thiếu loại báo cáo hoặc nội dung" }, { status: 400 });
  }

  const report = await prisma.report.create({
    data: {
      reporterId: session.user.id,
      examId: examId || null,
      type: String(type),
      description: String(description).trim(),
    },
  });

  return NextResponse.json({ report }, { status: 201 });
}