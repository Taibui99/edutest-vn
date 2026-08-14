"use client";

import dynamic from "next/dynamic";
import type { InitialExam } from "./editor";

export const TaoDeThiEditorLazy = dynamic(() => import("./editor").then((m) => m.TaoDeThiEditor), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-10 text-center text-sm text-[var(--text-muted)]">
      Đang tải trình soạn thảo…
    </div>
  ),
});

export type { InitialExam };