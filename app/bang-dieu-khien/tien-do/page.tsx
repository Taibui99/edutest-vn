import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { effectiveMode } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const ProgressClient = dynamic(() => import("./progress-client").then((m) => m.ProgressClient));

export const metadata: Metadata = {
  title: "Tiến độ học tập — EduTest",
};

export default async function TienDoPage() {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  if (effectiveMode(session.user) !== "student") redirect("/bang-dieu-khien");

  const submissions = await prisma.submission.findMany({
    where: { studentId: session.user.id },
    orderBy: { submittedAt: "desc" },
    take: 200,
    include: { exam: { select: { title: true, subject: true } } },
  });

  return (
    <ProgressClient
      submissions={submissions.map((s) => ({
        id: s.id,
        title: s.exam.title,
        subject: s.exam.subject,
        score: s.score,
        totalQuestions: s.totalQuestions,
        correctCount: s.correctCount,
        durationSeconds: s.durationSeconds,
        submittedAt: s.submittedAt.toISOString(),
      }))}
    />
  );
}