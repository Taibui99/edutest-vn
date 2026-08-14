"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Search, Flame, FileCheck, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  school: string | null;
  streak: number;
  classes: string[];
  submissions: number;
  avgScore: number | null;
}

function scoreColor(score: number) {
  if (score >= 8) return "#16A34A";
  if (score >= 5) return "#D97706";
  return "#DC2626";
}

export function StudentListClient({ students }: { students: Student[] }) {
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (onlyActive && s.submissions === 0) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.classes.some((c) => c.toLowerCase().includes(q));
    });
  }, [students, query, onlyActive]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, email hoặc lớp..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-[#6C63FF]" />
          Có bài nộp
        </label>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-12">
          <p className="text-center text-sm text-[#64748B]">Không tìm thấy học sinh phù hợp</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => (
            <Card key={s.id} className="px-5 py-4 flex items-center gap-4 min-w-0">
              <Avatar name={s.name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-bold text-[#0F172A] truncate">{s.name}</p>
                  <Badge variant="default">{s.grade || "Chưa có lớp"}</Badge>
                  {s.streak > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-orange-500 shrink-0">
                      <Flame size={12} /> {s.streak} ngày
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#64748B] truncate">{s.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {s.classes.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6C63FF] bg-[#EEEFFE] rounded-md px-2 py-0.5">
                      <GraduationCap size={11} /> {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-500">
                  <FileCheck size={13} className="text-[#06D6A0]" /> {s.submissions} bài
                </div>
                <div className="mt-1 flex items-center justify-end gap-1 text-sm font-black" style={{ color: s.avgScore === null ? "#94A3B8" : scoreColor(s.avgScore) }}>
                  <TrendingUp size={13} /> {s.avgScore === null ? "—" : `${s.avgScore}/10`}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}