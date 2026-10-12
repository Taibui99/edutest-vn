"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";

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
      <Dropdown
        value={initialSubject}
        onChange={(v) => navigate(q, v, initialStatus)}
        options={[{ value: "", label: "Tất cả môn" }, ...subjects.map((s) => ({ value: s, label: s }))]}
        ariaLabel="Lọc theo môn"
        className="sm:min-w-[150px]"
      />
      <Dropdown
        value={initialStatus}
        onChange={(v) => navigate(q, initialSubject, v)}
        options={[
          { value: "", label: "Tất cả trạng thái" },
          { value: "published", label: "Đang mở" },
          { value: "draft", label: "Bản nháp" },
        ]}
        ariaLabel="Lọc theo trạng thái"
        className="sm:min-w-[140px]"
      />
    </div>
  );
}