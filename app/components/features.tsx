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
  color: { bg: string; text: string };
  title: string;
  desc: string;
};

const STUDENT_FEATURES: Feature[] = [
  {
    icon: FileText,
    color: { bg: "var(--primary-light)", text: "var(--primary)" },
    title: "Vào thi bằng mã hoặc link",
    desc: "Mở đề giáo viên gửi và bắt đầu làm bài nhanh chóng. Học sinh chưa có tài khoản vẫn có thể tham gia khi đề cho phép.",
  },
  {
    icon: Timer,
    color: { bg: "var(--mint-light)", text: "var(--mint)" },
    title: "Timer + tự nộp bài",
    desc: "Đồng hồ đếm ngược và tự động nộp khi hết giờ. Kết quả được ghi nhận ngay sau khi hoàn thành.",
  },
  {
    icon: Layers,
    color: { bg: "var(--warning-light)", text: "#C49A00" },
    title: "Flashcard thông minh",
    desc: "Ôn tập theo lịch thông minh để ghi nhớ kiến thức tốt hơn và duy trì thói quen học mỗi ngày.",
  },
  {
    icon: Bot,
    color: { bg: "var(--danger-light)", text: "var(--danger)" },
    title: "AI Study Coach",
    desc: "Hỗ trợ giải đáp, phân tích kết quả học tập và đề xuất nội dung ôn tập phù hợp.",
  },
  {
    icon: CalendarDays,
    color: { bg: "var(--blue-light)", text: "var(--blue)" },
    title: "Đếm ngược THPT",
    desc: "Theo dõi thời gian còn lại đến kỳ thi và lên kế hoạch ôn tập rõ ràng hơn.",
  },
  {
    icon: LineChart,
    color: { bg: "var(--mint-light)", text: "var(--mint)" },
    title: "Xem lại kết quả",
    desc: "Xem điểm, số câu đúng và thông tin kết quả sau khi hoàn thành bài thi.",
  },
];

const TEACHER_FEATURES: Feature[] = [
  {
    icon: PencilLine,
    color: { bg: "var(--primary-light)", text: "var(--primary)" },
    title: "Tạo đề trên một màn hình",
    desc: "Soạn câu hỏi trực tiếp, chỉnh sửa nhanh hoặc import PDF/Word rồi tiếp tục hoàn thiện trước khi xuất bản.",
  },
  {
    icon: School,
    color: { bg: "var(--warning-light)", text: "#C49A00" },
    title: "Quản lý lớp học",
    desc: "Tạo lớp, quản lý học sinh và giao đề trực tiếp cho lớp. Học sinh có thể tham gia bằng tài khoản hoặc guest tùy cấu hình đề.",
  },
  {
    icon: TrendingUp,
    color: { bg: "var(--danger-light)", text: "var(--danger)" },
    title: "Thống kê kết quả",
    desc: "Xem bài nộp, điểm trung bình, phân bố điểm và kết quả của học sinh theo từng đề.",
  },
];

function FeatureGrid({ badge, badgeColor, heading, features }: { badge: string; badgeColor: { bg: string; text: string }; heading: string; features: Feature[] }) {
  return (
    <>
      <div className="mb-12 text-center">
        <span
          className="inline-block rounded-full px-3 py-1 text-sm font-bold"
          style={{ background: badgeColor.bg, color: badgeColor.text }}
        >
          {badge}
        </span>
        <h2 className="mt-3 text-2xl font-black sm:text-3xl" style={{ color: "var(--text-primary)" }}>
          {heading}
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl p-5 transition-transform hover:-translate-y-1 motion-card"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <div
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: f.color.bg, color: f.color.text }}
            >
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-1.5 font-black" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function Features() {
  return (
    <section id="tinh-nang" className="py-20 sm:py-24" style={{ background: "var(--surface-bg)" }}>
      <div className="mx-auto max-w-5xl px-5">
        <FeatureGrid
          badge="Dành cho học sinh"
          badgeColor={{ bg: "var(--primary-light)", text: "var(--primary)" }}
          heading="Học và kiểm tra thuận tiện hơn"
          features={STUDENT_FEATURES}
        />
        <div className="mt-16">
          <FeatureGrid
            badge="Dành cho giáo viên"
            badgeColor={{ bg: "var(--mint-light)", text: "var(--mint)" }}
            heading="Tạo đề và quản lý lớp học dễ dàng"
            features={TEACHER_FEATURES}
          />
        </div>
      </div>
    </section>
  );
}