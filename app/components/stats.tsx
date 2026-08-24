interface StatItem {
  value: string;
  label: string;
  color: string;
}

const DEFAULT_STATS: StatItem[] = [
  { value: "0", label: "Đề thi đã tạo", color: "var(--primary)" },
  { value: "0", label: "Bài nộp đã chấm", color: "var(--mint)" },
  { value: "0", label: "Câu hỏi đã soạn", color: "var(--coral)" },
  { value: "0", label: "Người dùng đang học & dạy", color: "var(--warning)" },
];

export function Stats({ stats = DEFAULT_STATS }: { stats?: StatItem[] }) {
  return (
    <section
      className="border-y py-12"
      style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)" }}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-5 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p
              className="text-3xl font-black sm:text-4xl"
              style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
            >
              {s.value}
            </p>
            <p className="mt-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
