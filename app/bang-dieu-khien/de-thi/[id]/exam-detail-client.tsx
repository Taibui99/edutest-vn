"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExamDetailClient({
  examId,
  status,
}: {
  examId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const isPublished = currentStatus === "published";

  const toggleStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isPublished ? "draft" : "published" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể cập nhật");
      setCurrentStatus(data.exam.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật");
    } finally {
      setLoading(false);
    }
  };

  const deleteExam = async () => {
    const confirmed = window.confirm(
      "Xoá đề thi này? Toàn bộ câu hỏi và bài nộp liên quan sẽ bị xoá vĩnh viễn.",
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xoá đề thi");
      router.push("/bang-dieu-khien");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xoá đề thi");
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          isPublished ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {isPublished ? "Đang mở" : "Bản nháp / Đã ẩn"}
      </span>
      <button
        onClick={toggleStatus}
        disabled={loading}
        className="h-9 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
      >
        {isPublished ? "Ẩn đề thi" : "Mở lại đề thi"}
      </button>
      <button
        onClick={deleteExam}
        disabled={loading}
        className="h-9 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        Xoá đề thi
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
