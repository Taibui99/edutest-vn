import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { examCode?: unknown; name?: unknown; className?: unknown };
    const examCode = cleanText(body.examCode, 20).toUpperCase();
    const name = cleanText(body.name, 100);
    const className = cleanText(body.className, 50);

    if (!examCode || !name || !className) {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ họ tên và lớp." }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({ where: { joinCode: examCode } });
    if (!exam || exam.status !== "published") {
      return NextResponse.json({ error: "Đề thi không tồn tại hoặc chưa được công bố." }, { status: 404 });
    }
    if (!exam.allowGuestAttempts) {
      return NextResponse.json({ error: "Đề thi này yêu cầu đăng nhập tài khoản EduTest." }, { status: 403 });
    }

    const token = randomBytes(32).toString("base64url");
    const participant = await prisma.guestParticipant.create({
      data: {
        examId: exam.id,
        name,
        className,
        tokenHash: hashToken(token),
      },
      select: { id: true, name: true, className: true, startedAt: true },
    });

    const response = NextResponse.json({
      participant,
      exam: { id: exam.id, code: exam.joinCode, title: exam.title },
    }, { status: 201 });

    response.cookies.set(`edutest_guest_${exam.id}`, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(60 * 60, exam.durationMinutes * 60 + 60 * 60),
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Không thể bắt đầu bài thi. Vui lòng thử lại." }, { status: 500 });
  }
}
