import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type ChatHistoryMessage = { role: string; content: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json({ error: "AI chưa được cấu hình" }, { status: 500 });

  const { message, history } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Tin nhắn trống" }, { status: 400 });

  const userId = session.user.id!;
  const isTeacher = session.user.role === "teacher";

  let context = "";

  if (!isTeacher) {
    const [submissions, dueCards, tasks, subjectProgress, userRecord] = await Promise.all([
      prisma.submission.findMany({
        where: { studentId: userId },
        include: { exam: { select: { title: true, subject: true } } },
        orderBy: { submittedAt: "desc" },
        take: 10,
      }),
      prisma.flashcard.count({ where: { studentId: userId, nextReviewAt: { lte: new Date() } } }),
      prisma.studyTask.findMany({ where: { studentId: userId, completed: false }, take: 5 }),
      prisma.subjectProgress.findMany({ where: { studentId: userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { examDate: true, name: true } }),
    ]);

    const avgScore = submissions.length > 0
      ? (submissions.reduce((s: number, x: { score: number }) => s + x.score, 0) / submissions.length).toFixed(1)
      : "chưa có";

    const daysLeft = userRecord?.examDate
      ? Math.max(0, Math.ceil((new Date(userRecord.examDate).getTime() - Date.now()) / 86400000))
      : null;

    const subjectScores: Record<string, number[]> = {};
    for (const s of submissions as { exam: { subject: string }; score: number }[]) {
      if (!subjectScores[s.exam.subject]) subjectScores[s.exam.subject] = [];
      subjectScores[s.exam.subject].push(s.score);
    }

    const weakSubjects = Object.entries(subjectScores)
      .map(([subj, scores]) => ({ subj, avg: (scores as number[]).reduce((a: number, b: number) => a + b, 0) / (scores as number[]).length }))
      .filter((s) => s.avg < 6.5)
      .map((s) => `${s.subj} (TB ${s.avg.toFixed(1)})`);

    context = `
[Thông tin học sinh: ${userRecord?.name ?? session.user.name}]
- Điểm trung bình: ${avgScore}/10
- Số bài đã thi: ${submissions.length}
- Flashcard cần ôn hôm nay: ${dueCards}
- Nhiệm vụ chưa hoàn thành: ${tasks.length}
- Môn yếu cần chú ý: ${weakSubjects.length > 0 ? weakSubjects.join(", ") : "không có"}
- Tiến độ các môn: ${subjectProgress.map((p: { subject: string; progress: number }) => `${p.subject}: ${p.progress}%`).join(", ") || "chưa cập nhật"}
${daysLeft !== null ? `- Còn ${daysLeft} ngày đến kỳ thi THPT` : ""}
- Kết quả gần đây: ${submissions.slice(0, 5).map((s: { exam: { title: string; subject: string }; score: number }) => `${s.exam.title} (${s.exam.subject}): ${s.score}/10`).join("; ") || "chưa có"}
`;
  } else {
    const [exams, totalSubs] = await Promise.all([
      prisma.exam.count({ where: { teacherId: userId } }),
      prisma.submission.count({ where: { exam: { teacherId: userId } } }),
    ]);
    context = `[Thông tin giáo viên: ${session.user.name}]\n- Tổng đề thi: ${exams}\n- Tổng bài nộp: ${totalSubs}`;
  }

  const systemPrompt = isTeacher
    ? `Bạn là AI hỗ trợ giáo viên của nền tảng EduTest.vn. 
Hỗ trợ giáo viên tạo câu hỏi, phân tích kết quả lớp, đề xuất nội dung ôn tập.
${context}
Trả lời bằng tiếng Việt, ngắn gọn, hữu ích và chuyên nghiệp.`
    : `Bạn là AI Study Coach của EduTest.vn — người hướng dẫn học tập thân thiện cho học sinh Việt Nam.
Dựa vào dữ liệu học tập thực tế của học sinh để tư vấn cụ thể, không chung chung.
${context}
Hãy:
- Động viên và hỗ trợ học sinh
- Đề xuất kế hoạch học tập dựa trên điểm yếu thực tế
- Giải thích kiến thức khi được hỏi
- Tạo câu hỏi luyện tập khi cần
- Trả lời bằng tiếng Việt, thân thiện như một người bạn/gia sư`;

  try {
    const model = genAI.getGenerativeModel({ model: MODEL });

    const normalizedHistory = (Array.isArray(history) ? history : [])
      .map((m: ChatHistoryMessage) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        content: typeof m.content === "string" ? m.content.trim() : "",
      }))
      .filter((m) => m.content.length > 0);

    const firstUserIndex = normalizedHistory.findIndex((m) => m.role === "user");
    const validHistory = firstUserIndex >= 0 ? normalizedHistory.slice(firstUserIndex) : [];

    const chat = model.startChat({
      history: validHistory.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text();
    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("AI error:", err);
    return NextResponse.json({ error: "AI đang bận, thử lại sau nhé!" }, { status: 500 });
  }
}
