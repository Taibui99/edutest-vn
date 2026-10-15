import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

const MESSAGES: Record<string, string> = {
  invalid: "Vui lòng nhập đầy đủ họ tên và lớp.",
  notfound: "Đề thi không tồn tại hoặc chưa được công bố.",
  forbidden: "Đề thi này yêu cầu đăng nhập tài khoản A6Class Edu.",
  server: "Không thể bắt đầu bài thi. Vui lòng thử lại.",
};

/* GUEST-3 — route phục vụ HAI kiểu client:
 *  - Form POST thật (application/x-www-form-urlencoded) từ `guest-join.tsx`
 *    (chạy được khi JS tắt / máy iOS cũ không hydrate): trả **303 redirect** về
 *    `/thi/<code>`; trình duyệt theo redirect mang theo cookie → vào bài.
 *  - JSON (fetch) cho client cũ: giữ nguyên hành vi trả JSON 201.
 *  Lỗi: form → 303 quay lại form kèm `?guestError=`; JSON → mã lỗi như trước. */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const isForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  let examId = "";
  // Lỗi: form → 303 quay lại form kèm `?guestError=`; JSON → mã lỗi như trước.
  const deny = (key: keyof typeof MESSAGES, status: number) => {
    if (isForm) {
      const url = examId ? new URL(`/thi/${examId}`, request.url) : new URL("/vao-thi", request.url);
      if (examId) url.searchParams.set("guestError", key);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: MESSAGES[key] }, { status });
  };

  try {
    let rawCode: unknown, rawName: unknown, rawClass: unknown;
    if (isForm) {
      const form = await request.formData();
      rawCode = form.get("examCode");
      rawName = form.get("name");
      rawClass = form.get("class") ?? form.get("className");
    } else {
      const body = await request.json() as { examCode?: unknown; name?: unknown; className?: unknown };
      rawCode = body.examCode;
      rawName = body.name;
      rawClass = body.className;
    }

    const examCode = cleanText(rawCode, 20).toUpperCase();
    const name = cleanText(rawName, 100);
    const className = cleanText(rawClass, 50);

    if (!examCode || !name || !className) return deny("invalid", 400);

    const exam = await prisma.exam.findUnique({ where: { joinCode: examCode } });
    if (!exam || exam.status !== "published" || exam.hidden || exam.deletedAt) return deny("notfound", 404);
    if (!exam.allowGuestAttempts) return deny("forbidden", 403);

    examId = exam.joinCode;

    const token = randomBytes(32).toString("base64url");
    const participant = await prisma.guestParticipant.create({
      data: { examId: exam.id, name, className, tokenHash: hashToken(token) },
      select: { id: true, name: true, className: true, startedAt: true },
    });

    let response: NextResponse;
    if (isForm) {
      response = NextResponse.redirect(new URL(`/thi/${exam.joinCode}`, request.url), 303);
    } else {
      response = NextResponse.json({
        participant,
        exam: { id: exam.id, code: exam.joinCode, title: exam.title },
      }, { status: 201 });
    }

    response.cookies.set(`edutest_guest_${exam.id}`, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(60 * 60, exam.durationMinutes * 60 + 60 * 60),
    });

    return response;
  } catch {
    return deny("server", 500);
  }
}
