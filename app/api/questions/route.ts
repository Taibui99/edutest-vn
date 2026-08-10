import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: all questions from teacher's exams
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject") || undefined;
  const search  = searchParams.get("q") || undefined;

  const questions = await prisma.question.findMany({
    where: {
      exam: { teacherId: session.user.id! },
      ...(subject ? { exam: { teacherId: session.user.id!, subject } } : {}),
      ...(search ? { text: { contains: search, mode: "insensitive" } } : {}),
    },
    include: {
      exam: { select: { id: true, title: true, subject: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(questions);
}
