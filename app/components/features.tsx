import {
  Bot,
  CalendarDays,
  FileText,
  Layers,
  LineChart,
  PencilLine,
  School,
  Timer,
  TrendingUp,
} from "lucide-react";

type Feature = {
  icon: typeof FileText;
  title: string;
  desc: string;
};

const STUDENT_FEATURES: Feature[] = [
  {
    icon: FileText,
    title: "Vào thi bằng mã hoặc link",
    desc: "Mở đề giáo viên gửi và bắt đầu làm bài ngay. Học sinh chưa có tài khoản vẫn tham gia được khi đề cho phép.",
  },
  {
    icon: Timer,
    title: "Timer + tự nộp bài",
    desc: "Đồng hồ đếm ngược và tự động nộp khi hết giờ. Kết quả được ghi nhận ngay sau khi hoàn thành.",
  },
  {
    icon: Layers,
    title: "Flashcard ôn tập",
    desc: "Ôn bài theo lịch để ghi nhớ lâu hơn và duy trì thói quen học mỗi ngày.",
  },
  {
    icon: LineChart,
    title: "Xem lại kết quả",
    desc: "Xem điểm, số câu đúng và chi tiết đáp án sau khi hoàn thành bài thi.",
  },
];

const TEACHER_FEATURES: Feature[] = [
  {
    icon: PencilLine,
    title: "Tạo đề trên một màn hình",
    desc: "Soạn câu hỏi trực tiếp hoặc import PDF/Word rồi tiếp tục hoàn thiện trước khi xuất bản.",
  },
  {
    icon: School,
    title: "Quản lý lớp học",
    desc: "Tạo lớp, quản lý học sinh và giao đề trực tiếp cho lớp.",
  },
  {
    icon: TrendingUp,
    title: "Thống kê kết quả",
    desc: "Xem bài nộp, điểm trung bình, phân bố điểm theo từng đề.",
  },
];

function FeatureGrid({ badge, badgeText, heading, features }: { badge: string; badgeText: string; heading: string; features: Feature[] }) {
  return (
    <>
      <div className="mb-10">
        <span
          className="inline-block rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ background: "var(--gray-100)", color: "var(--primary)" }}
        >
          {badgeText}
        </span>
        <h2 className="mt-3 text-2xl font-black sm:text-3xl" style={{ color: "var(--text-primary)" }}>
          {heading}
        </h2>
        <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--text-secondary)" }}>{badge}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border p-5"
            style={{ background: "var(--surface-card)", borderColor: "var(--surface-border)" }}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-1.5 font-bold" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function Features() {
  return (
    <section id="tinh-nang" className="py-16 sm:py-20" style={{ background: "var(--surface-bg)" }}>
      <div className="mx-auto max-w-5xl px-5">
        <FeatureGrid
          badge="Học sinh mở đề, làm bài và xem lại kết quả mà không cần cài đặt gì thêm."
          badgeText="Dành cho học sinh"
          heading="Học và kiểm tra thuận tiện hơn"
          features={STUDENT_FEATURES}
        />
        <div className="mt-14">
          <FeatureGrid
            badge="Giáo viên tạo đề, giao cho lớp và xem thống kê từng bài nộp."
            badgeText="Dành cho giáo viên"
            heading="Tạo đề và quản lý lớp học dễ dàng"
            features={TEACHER_FEATURES}
          />
        </div>
      </div>
    </section>
  );
}