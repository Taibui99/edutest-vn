import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/* GUEST-4 — "Làm lại" của khách: xoá cookie phiên khách cho đề này để lần sau
 * vào lại sẽ tạo người tham gia mới. Hỗ trợ cả form POST (không cần JS) lẫn
 * fetch JSON; form POST thì 303 redirect về `/thi/<code>` kèm tên/lớp để điền
 * sẵn form tham gia lại. */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const isForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  let rawCode: unknown, rawName: unknown, rawClass: unknown;
  if (isForm) {
    const form = await request.formData();
    rawCode = form.get("examCode");
    rawName = form.get("name");
    rawClass = form.get("class") ?? form.get("className");
  } else {
    const body = (await request.json().catch(() => ({}))) as { examCode?: unknown; name?: unknown; className?: unknown };
    rawCode = body.examCode;
    rawName = body.name;
    rawClass = body.className;
  }

  const examCode = cleanText(rawCode, 20).toUpperCase();
  const name = cleanText(rawName, 100);
  const className = cleanText(rawClass, 50);
  const exam = examCode ? await prisma.exam.findUnique({ where: { joinCode: examCode }, select: { id: true, joinCode: true } }) : null;

  let response: NextResponse;
  if (isForm) {
    const url = exam ? new URL(`/thi/${exam.joinCode}`, request.url) : new URL("/vao-thi", request.url);
    if (exam && name) url.searchParams.set("name", name);
    if (exam && className) url.searchParams.set("class", className);
    response = NextResponse.redirect(url, 303);
  } else {
    response = NextResponse.json({ ok: true });
  }

  if (exam) {
    response.cookies.set(`edutest_guest_${exam.id}`, "", { path: "/", maxAge: 0 });
  }
  return response;
}
