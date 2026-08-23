"use client";

import { useState } from "react";
import {
  ListChecks,
  ToggleLeft,
  TextCursorInput,
  Layers,
  PencilLine,
  Check,
  Plus,
} from "lucide-react";

type QType = "tn" | "ds" | "dt";

const PRESETS: Record<QType, { q: string; opts: { t: string; ok: boolean }[] }> = {
  tn: {
    q: "Thành phố nào là thủ đô của Nhật Bản?",
    opts: [
      { t: "Tokyo", ok: true },
      { t: "Osaka", ok: false },
      { t: "Kyoto", ok: false },
      { t: "Sapporo", ok: false },
    ],
  },
  ds: {
    q: "Tam giác đều có ba góc bằng nhau.",
    opts: [
      { t: "Đúng", ok: true },
      { t: "Sai", ok: false },
    ],
  },
  dt: {
    q: "Điền kết quả: 12 × 8 = ____",
    opts: [
      { t: "96", ok: true },
      { t: "86", ok: false },
      { t: "106", ok: false },
      { t: "88", ok: false },
    ],
  },
};

const TYPE_TABS: { id: QType; label: string; icon: typeof ListChecks }[] = [
  { id: "tn", label: "Trắc nghiệm", icon: ListChecks },
  { id: "ds", label: "Đúng – Sai", icon: ToggleLeft },
  { id: "dt", label: "Điền khuyết", icon: TextCursorInput },
];

export function BuilderDemo() {
  const [type, setType] = useState<QType>("tn");
  const [marked, setMarked] = useState(0);
  const [count, setCount] = useState(40);
  const [toast, setToast] = useState("");

  const preset = PRESETS[type];

  const pickType = (id: QType) => {
    setType(id);
    setMarked(0);
    setToast("");
  };

  const mark = (i: number) => {
    setMarked(i);
    setToast("Đã đánh dấu đáp án đúng");
  };

  const addQuestion = () => {
    setCount((c) => c + 1);
    setToast(`Đã thêm · ${count + 1} câu`);
  };

  return (
    <div
      className="relative mx-auto w-full max-w-md rounded-3xl border p-6 shadow-lg"
      style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)" }}
    >
      {/* toast */}
      <div
        aria-live="polite"
        className="absolute -top-3 right-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white transition-all duration-300"
        style={{
          background: "var(--success)",
          opacity: toast ? 1 : 0,
          transform: toast ? "translateY(0)" : "translateY(-6px)",
          pointerEvents: "none",
        }}
      >
        <Check className="h-3.5 w-3.5" />
        {toast || "…"}
      </div>

      <div className="flex items-center justify-between gap-3 pb-4">
        <span className="inline-flex items-center gap-2 text-base font-bold" style={{ color: "var(--text-primary)" }}>
          <PencilLine className="h-[18px] w-[18px]" style={{ color: "var(--primary)" }} />
          Soạn nhanh một câu
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          <Layers className="h-3.5 w-3.5" />
          {count} câu trong đề
        </span>
      </div>

      {/* type chips */}
      <div className="flex flex-wrap gap-2 pb-4">
        {TYPE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pickType(t.id)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors motion-button"
            style={
              type === t.id
                ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" }
                : { background: "var(--surface-card)", borderColor: "var(--surface-border-strong)", color: "var(--text-secondary)" }
            }
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <p
        className="rounded-2xl border border-dashed px-4 py-3.5 text-[15px] font-semibold leading-snug"
        style={{ borderColor: "var(--surface-border-strong)", background: "var(--surface-bg)", color: "var(--text-primary)" }}
      >
        {preset.q}
      </p>

      <div className="mt-3 space-y-2">
        {preset.opts.map((o, i) => {
          const selected = marked === i;
          return (
            <button
              key={o.t}
              type="button"
              onClick={() => mark(i)}
              className="flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-all motion-button hover:translate-x-0.5"
              style={{
                borderColor: selected ? "var(--success)" : "var(--surface-border)",
                background: selected ? "var(--success-light)" : "var(--surface-card)",
                color: selected ? "var(--success)" : "var(--text-secondary)",
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: selected ? "var(--success)" : "var(--surface-border-strong)",
                  background: selected ? "var(--success)" : "transparent",
                  color: "#fff",
                }}
              >
                {selected && <Check className="h-3 w-3" />}
              </span>
              {o.t}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          Bấm vòng tròn để chọn đáp án đúng
        </span>
        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all motion-button hover:-translate-y-px active:scale-[.98]"
          style={{ background: "var(--primary)" }}
        >
          <Plus className="h-4 w-4" />
          Thêm vào đề
        </button>
      </div>
    </div>
  );
}
