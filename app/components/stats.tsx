const STATS = [
  { value: "20k+", label: "Đề thi đã tạo", color: "var(--primary)" },
  { value: "50k+", label: "Bài nộp đã chấm", color: "var(--mint)" },
  { value: "15k+", label: "Học sinh ôn luyện", color: "var(--coral)" },
  { value: "99%", label: "Kết quả được phản hồi ngay", color: "var(--warning)" },
];

export function Stats() {
  return (
    <section
      className="border-y py-12"
      style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)" }}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-5 sm:grid-cols-4">
        {STATS.map((s) => (
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