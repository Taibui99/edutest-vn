import { prisma } from "@/lib/prisma";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Tăng streak ngày học thật sự:
 * - Học lần đầu trong ngày: streak giữ nguyên nếu hôm qua có học, ngược lại reset về 1.
 * - Chỉ cập nhật lastStudyDate/streak một lần mỗi ngày (so với lastStudyDate).
 * Trả về streak mới nhất (để client hiển thị ngay).
 */
export async function bumpStudyStreak(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streak: true, lastStudyDate: true },
  });
  if (!user) return 0;

  const today = startOfDay(new Date());
  const last = user.lastStudyDate ? startOfDay(user.lastStudyDate) : null;

  if (last && last.getTime() === today.getTime()) {
    return user.streak;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const newStreak = last && last.getTime() === yesterday.getTime() ? user.streak + 1 : 1;

  await prisma.user.update({
    where: { id: userId },
    data: { streak: newStreak, lastStudyDate: new Date() },
  });

  return newStreak;
}
