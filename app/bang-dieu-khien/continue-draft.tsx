"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, FileText, Play, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSubjectColor } from "@/lib/subject";

type Draft = {
  answers: Record<string, unknown>;
  marked: Record<string, boolean>;
  remaining: number;
  meta?: { title: string; joinCode: string; subject: string; totalQuestions: number };
  savedAt?: number;
};

const DRAFT_PREFIX = "edutest-draft-";

function formatRemaining(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "vừa xong";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return new Date(ts).toLocaleDateString("vi-VN");
}

export function ContinueDraftCard() {
  const [drafts, setDrafts] = useState<{ key: string; examId: string; data: Draft }[]>([]);

  const load = () => {
    if (typeof window === "undefined") return;
    const out: { key: string; examId: string; data: Draft }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(DRAFT_PREFIX)) continue;
      try {
        const data = JSON.parse(window.localStorage.getItem(key) || "null") as Draft | null;
        if (data && typeof data === "object") {
          out.push({ key, examId: key.slice(DRAFT_PREFIX.length), data });
        }
      } catch {
        /* corrupt */
      }
    }
    out.sort((a, b) => (b.data.savedAt || 0) - (a.data.savedAt || 0));
    setDrafts(out);
  };

  useEffect(() => {
    load();
    const onStorage = () => load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (drafts.length === 0) return null;

  return (
    <Card padding="none" className="mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
        <h2 className="text-sm font-black text-[var(--text-primary)]">
          <Play size={14} className="inline mr-1.5 text-[var(--primary)]" />
          Tiếp tục bài dở
        </h2>
        <span className="text-xs text-[var(--text-muted)]">{drafts.length} bài đang dở</span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {drafts.map(({ key, examId, data }) => {
          const meta = data.meta;
          const title = meta?.title || "Bài thi";
          const answered = Object.keys(data.answers || {}).length;
          const total = meta?.totalQuestions ?? 0;
          const c = getSubjectColor(meta?.subject || "");
          const remaining = typeof data.remaining === "number" ? data.remaining : 0;
          const href = meta?.joinCode ? `/thi/${meta.joinCode}` : `/thi/${examId}`;
          return (
            <div key={key} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--gray-100)] transition-colors">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: c.bg }}
              >
                <FileText size={15} style={{ color: c.text }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</p>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
                  <span>{answered}/{total} câu đã làm</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock size={9} /> còn {formatRemaining(remaining)}
                  </span>
                  {data.savedAt && <span>· {formatAgo(data.savedAt)}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  href={href}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--primary-hover)]"
                >
                  <Play size={13} /> Tiếp tục
                </Link>
                <button
                  type="button"
                  aria-label="Bỏ bài dở"
                  onClick={() => {
                    try {
                      window.localStorage.removeItem(key);
                    } catch {
                      /* ignore */
                    }
                    load();
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--gray-100)] hover:text-[var(--danger)] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}