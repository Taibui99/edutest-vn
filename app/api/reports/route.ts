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

  const desc = String(description).trim();
  if (desc.length > 2000) {
    return NextResponse.json({ error: "Nội dung báo cáo tối đa 2000 ký tự" }, { status: 400 });
  }

  const report = await prisma.report.create({
    data: {
      reporterId: session.user.id,
      examId: examId || null,
      type: String(type).slice(0, 100),
      description: desc,
    },
  });

  return NextResponse.json({ report }, { status: 201 });
}