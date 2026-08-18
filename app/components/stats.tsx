import { FileCheck2, GraduationCap, KeyRound, Zap } from "lucide-react";

const FACTS = [
  { icon: FileCheck2, title: "Chấm điểm tự động", desc: "Trắc nghiệm, đúng/sai, điền đáp án — có kết quả ngay sau khi nộp." },
  { icon: KeyRound, title: "Không bắt buộc tài khoản", desc: "Học sinh vào thi bằng mã hoặc link, chỉ cần nhập tên và lớp." },
  { icon: GraduationCap, title: "Theo dõi tiến độ", desc: "Lịch sử điểm, streak học tập và flashcard ôn bài cho từng học sinh." },
  { icon: Zap, title: "Phù hợp trường Việt Nam", desc: "Môn học theo chương trình, phòng chống gian lận, giao bài theo lớp." },
];

export function Stats() {
  return (
    <section className="border-b" style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)" }}>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map((f) => (
          <div key={f.title} className="px-5 py-8">
            <f.icon className="mb-3 h-6 w-6" style={{ color: "var(--primary)" }} />
            <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{f.title}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}