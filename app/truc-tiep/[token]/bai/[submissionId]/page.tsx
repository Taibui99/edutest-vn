import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiveSubmissionByToken } from "@/lib/live-board";
import { LiveSubmissionView } from "./submission-view";

/* LIVE-1b — màn chi tiết 1 bài làm, mở từ bảng điểm khi bấm tên học sinh.
 * Cùng token bí mật, không cần đăng nhập; server render lần đầu, client poll. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chi tiết bài làm — A6Class Edu",
  robots: { index: false, follow: false },
};

export default async function LiveSubmissionPage({
  params,
}: {
  params: Promise<{ token: string; submissionId: string }>;
}) {
  const { token, submissionId } = await params;
  const detail = await getLiveSubmissionByToken(
    decodeURIComponent(token ?? ""),
    decodeURIComponent(submissionId ?? ""),
  );
  if (!detail.found || !detail.exam || !detail.submission) notFound();

  return <LiveSubmissionView initial={detail} token={token} submissionId={submissionId} />;
}
