"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Search, Flame, FileCheck, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

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
  if (score >= 8) return "var(--score-good)";
  if (score >= 5) return "var(--score-mid)";
  return "var(--score-bad)";
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
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, email hoặc lớp..."
            className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-input)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
        <Checkbox
          checked={onlyActive}
          onChange={setOnlyActive}
          label={<span className="text-sm text-[var(--text-secondary)]">Có bài nộp</span>}
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="py-12">
          <p className="text-center text-sm text-[var(--text-secondary)]">Không tìm thấy học sinh phù hợp</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => (
            <Card key={s.id} className="px-5 py-4 flex items-center gap-4 min-w-0">
              <Avatar name={s.name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{s.name}</p>
                  <Badge variant="default">{s.grade || "Chưa có lớp"}</Badge>
                  {s.streak > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-orange-500 shrink-0">
                      <Flame size={12} /> {s.streak} ngày
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] truncate">{s.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {s.classes.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--primary)] bg-[var(--primary-light)] rounded-md px-2 py-0.5">
                      <GraduationCap size={11} /> {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center justify-end gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                  <FileCheck size={13} className="text-[var(--mint)]" /> {s.submissions} bài
                </div>
                <div className="mt-1 flex items-center justify-end gap-1 text-sm font-black" style={{ color: s.avgScore === null ? "var(--text-muted)" : scoreColor(s.avgScore) }}>
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