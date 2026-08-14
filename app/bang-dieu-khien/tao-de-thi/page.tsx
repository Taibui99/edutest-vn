import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { InitialExam } from "./editor";

const TaoDeThiEditor = dynamic(() => import("./editor").then((m) => m.TaoDeThiEditor), { ssr: false });

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ edit?: string }> }): Promise<Metadata> {
  const { edit } = await searchParams;
  return { title: edit ? "Sửa đề thi — EduTest" : "Tạo đề thi — EduTest" };
}

export default async function TaoDeThiPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  let initialExam: InitialExam | null = null;

  if (edit) {
    const session = await auth();
    if (session?.user?.role === "teacher") {
      const exam = await prisma.exam.findFirst({
        where: { id: edit, teacherId: session.user.id },
        select: {
          title: true,
          subject: true,
          description: true,
          durationMinutes: true,
          shuffleQuestions: true,
          shuffleAnswers: true,
          allowGuestAttempts: true,
          maxAttempts: true,
          showAnswers: true,
          showScoreImmediately: true,
          openAt: true,
          closeAt: true,
          status: true,
          questions: {
            orderBy: { order: "asc" },
            select: { type: true, text: true, options: true, answer: true, grading: true, points: true },
          },
        },
      });
      if (exam) initialExam = { ...exam, openAt: exam.openAt ? exam.openAt.toISOString() : null, closeAt: exam.closeAt ? exam.closeAt.toISOString() : null };
    }
  }

  return <TaoDeThiEditor editId={edit || null} initialExam={initialExam} />;
}
