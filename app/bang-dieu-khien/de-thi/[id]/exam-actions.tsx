"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Eye, EyeOff, Pencil } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

interface ExamActionsProps {
  examId: string;
  currentStatus: string;
}

export function ExamActions({ examId, currentStatus }: ExamActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"toggle" | "delete" | null>(null);
  const isPublished = currentStatus === "published";

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
        onClick={toggleStatus}
        disabled={loading !== null}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
          isPublished
            ? "text-[var(--warning)] hover:bg-[#FFF8E1]"
            : "text-[#06D6A0] hover:bg-[#E1F5EE]"
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
