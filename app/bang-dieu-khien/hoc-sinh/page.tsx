import type { Metadata } from "next";
import { auth } from "@/auth";
import { effectiveMode } from "@/lib/access";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GraduationCap, Users, FileCheck, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StudentListClient } from "./student-list-client";

export const metadata: Metadata = { title: "Học sinh — EduTest" };

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/dang-nhap");
  if (effectiveMode(session.user) !== "teacher") redirect("/bang-dieu-khien");

  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: session.user.id },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          student: {
            select: { id: true, name: true, email: true, grade: true, school: true, streak: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const studentsMap = new Map<string, { name: string; email: string; grade: string | null; school: string | null; streak: number; classes: string[] }>();
  for (const cls of classrooms) {
    for (const m of cls.members) {
      const s = m.student;
      const existing = studentsMap.get(s.id);
      if (existing) {
        existing.classes.push(cls.name);
      } else {
        studentsMap.set(s.id, { name: s.name, email: s.email, grade: s.grade, school: s.school, streak: s.streak, classes: [cls.name] });
      }
    }
  }

  const studentIds = [...studentsMap.keys()];
  const subAgg = studentIds.length > 0
    ? await prisma.submission.groupBy({
        by: ["studentId"],
        where: { studentId: { in: studentIds }, exam: { teacherId: session.user.id } },
        _count: { _all: true },
        _avg: { score: true },
      })
    : [];

  const stats = new Map(subAgg.map((r) => [r.studentId, { submissions: r._count._all, avgScore: r._avg.score ?? 0 }]));
  const students = studentIds.map((id) => {
    const s = studentsMap.get(id)!;
    const st = stats.get(id);
    return {
      id,
      name: s.name,
      email: s.email,
      grade: s.grade,
      school: s.school,
      streak: s.streak,
      classes: s.classes,
      submissions: st?.submissions ?? 0,
      avgScore: st ? Math.round(st.avgScore * 100) / 100 : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const totalSubmissions = subAgg.reduce((sum, r) => sum + r._count._all, 0);
  const avgAll = subAgg.length > 0 ? Math.round((subAgg.reduce((sum, r) => sum + (r._avg.score ?? 0), 0) / subAgg.length) * 100) / 100 : 0;

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Học sinh</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{students.length} học sinh trong các lớp của bạn</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Tổng học sinh", value: students.length, icon: <Users size={16} />, color: "#6C4CF1" },
          { label: "Lớp học", value: classrooms.length, icon: <GraduationCap size={16} />, color: "#06D6A0" },
          { label: "Bài đã nộp", value: totalSubmissions, icon: <FileCheck size={16} />, color: "#F97316" },
          { label: "Điểm TB", value: subAgg.length > 0 ? avgAll.toFixed(1) : "—", icon: <TrendingUp size={16} />, color: "#FFD166" },
        ].map((stat) => (
          <Card key={stat.label} className="px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: stat.color }}>{stat.icon}{stat.label}</div>
            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{stat.value}</p>
          </Card>
        ))}
      </div>

      {students.length === 0 ? (
        <Card className="py-16">
          <EmptyState
            icon={<Users />}
            title="Chưa có học sinh nào"
            description="Khi học sinh tham gia lớp học của bạn, họ sẽ xuất hiện ở đây"
          />
        </Card>
      ) : (
        <StudentListClient students={students} />
      )}
    </div>
  );
}