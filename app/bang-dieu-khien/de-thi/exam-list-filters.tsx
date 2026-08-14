"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function ExamListFilters({
  subjects,
  initialQ,
  initialSubject,
  initialStatus,
}: {
  subjects: string[];
  initialQ: string;
  initialSubject: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback((query: string, subject: string, status: string) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (subject) params.set("subject", subject);
    if (status) params.set("status", status);
    const next = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    if (next !== pathname + searchParams.toString()) router.push(next);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(q, initialSubject, initialStatus), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, navigate, initialSubject, initialStatus]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
      <div className="flex-1">
        <Input
          placeholder="Tìm theo tên đề..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          icon={<Search size={15} />}
        />
      </div>
      <select
        value={initialSubject}
        onChange={(e) => navigate(q, e.target.value, initialStatus)}
        className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] min-w-[150px]"
      >
        <option value="">Tất cả môn</option>
        {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select
        value={initialStatus}
        onChange={(e) => navigate(q, initialSubject, e.target.value)}
        className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] min-w-[140px]"
      >
        <option value="">Tất cả trạng thái</option>
        <option value="published">Đang mở</option>
        <option value="draft">Bản nháp</option>
      </select>
    </div>
  );
}