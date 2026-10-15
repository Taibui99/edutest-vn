"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Eye, EyeOff, Pencil, Copy } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface ExamActionsProps {
  examId: string;
  currentStatus: string;
}

export function ExamActions({ examId, currentStatus }: ExamActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"toggle" | "delete" | "duplicate" | null>(null);
  const isPublished = currentStatus === "published";

  /* EXAM-2 — nhân bản: sao chép câu hỏi + cài đặt sang đề MỚI ở trạng thái nháp
   * (không kèm lịch mở/đóng, bài nộp, link bảng điểm). Xong thì mở luôn đề mới. */
  const duplicateExam = async () => {
    setLoading("duplicate");
    try {
      const res = await fetch(`/api/exams/${examId}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.exam?.id) {
        throw new Error(typeof data.error === "string" ? data.error : "Không nhân bản được đề thi.");
      }
      router.push(`/bang-dieu-khien/de-thi/${data.exam.id}`);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Không nhân bản được đề thi.");
      setLoading(null);
    }
  };

  const toggleStatus = async () => {
    setLoading("toggle");
    await fetch(`/api/exams/${examId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: isPublished ? "draft" : "published" }),
    });
    router.refresh();
    setLoading(null);
  };

  const deleteExam = async () => {
    if (!confirm("Xóa đề thi này? Tất cả bài nộp cũng sẽ bị xóa. Hành động không thể hoàn tác.")) return;
    setLoading("delete");
    const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/bang-dieu-khien/de-thi");
    } else {
      alert("Không thể xóa đề thi.");
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--surface-border)]">
      <Link
        href={`/bang-dieu-khien/tao-de-thi?edit=${examId}`}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] px-3 py-1.5 rounded-lg hover:bg-[var(--primary-light)] transition-colors"
      >
        <Pencil size={13} /> Sửa đề
      </Link>

      <button
        onClick={duplicateExam}
        disabled={loading !== null}
        title="Tạo bản sao câu hỏi + cài đặt của đề này thành đề mới (bản nháp)"
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] px-3 py-1.5 rounded-lg hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
      >
        {loading === "duplicate" ? <Spinner size="sm" /> : <Copy size={13} />}
        Nhân bản
      </button>

      <button
        onClick={toggleStatus}
        disabled={loading !== null}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
          isPublished
            ? "text-[var(--warning)] hover:bg-[var(--warning-light)]"
            : "text-[var(--success)] hover:bg-[var(--success-light)]"
        }`}
      >
        {loading === "toggle" ? <Spinner size="sm" /> : isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
        {isPublished ? "Đóng đề" : "Mở lại"}
      </button>

      <button
        onClick={deleteExam}
        disabled={loading !== null}
        className="flex items-center gap-1.5 text-sm text-[var(--danger)] hover:bg-[var(--danger-light)] px-3 py-1.5 rounded-lg transition-colors ml-auto"
      >
        {loading === "delete" ? <Spinner size="sm" /> : <Trash2 size={13} />}
        Xóa đề
      </button>
    </div>
  );
}
