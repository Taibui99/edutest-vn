import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isTeacherAccess } from "@/lib/access";
import { solveMissingAnswers } from "@/lib/ai-solve";
import type { SmartQuestion } from "@/lib/ai-exam-build";

/**
 * "AI giải giúp" — giải từng câu trắc nghiệm GV chọn (modal import, review).
 * Tái dùng solveMissingAnswers (2 lượt độc lập + phá thế hoản) của pipeline
 * smart, nhưng chỉ trên danh sách câu gửi lên, không đụng tài liệu.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !isTeacherAccess(session.user)) {
    return NextResponse.json({ error: "Chỉ giáo viên mới dùng chức năng này" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { questions?: unknown };
  const raw = Array.isArray(body.questions) ? body.questions.slice(0, 20) : [];
  const items = raw
    .map((q) => {
      const o = q as { question?: unknown; options?: unknown };
      return {
        question: String(o.question ?? "").trim(),
        options: (Array.isArray(o.options) ? o.options : []).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4),
      };
    })
    .filter((q) => q.question && q.options.length >= 2);
  if (!items.length) {
    return NextResponse.json({ error: "Thiếu nội dung câu hỏi trắc nghiệm cần giải" }, { status: 400 });
  }

  const questions: SmartQuestion[] = items.map((it, i) => ({
    index: i,
    type: "mcq",
    question: it.question,
    options: it.options,
    answer: "",
  }));
  const r = await solveMissingAnswers(questions);
  return NextResponse.json({
    provider: r.provider,
    answers: r.questions.map((q) => ({ i: q.index, answer: q.answer, solveNote: q.solveNote, needsReview: q.needsReview })),
  });
}
