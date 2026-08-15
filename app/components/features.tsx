const STUDENT_FEATURES = [
  {
    emoji: "📝",
    color: { bg: "#EEEFFE", text: "#6C63FF" },
    title: "Vào thi bằng mã hoặc link",
    desc: "Mở đề giáo viên gửi và bắt đầu làm bài nhanh chóng. Học sinh chưa có tài khoản vẫn có thể tham gia khi đề cho phép.",
  },
  {
    emoji: "⏱️",
    color: { bg: "#E1F5EE", text: "#06D6A0" },
    title: "Timer + tự nộp bài",
    desc: "Đồng hồ đếm ngược và tự động nộp khi hết giờ. Kết quả được ghi nhận ngay sau khi hoàn thành.",
  },
  {
    emoji: "🃏",
    color: { bg: "#FFF8E1", text: "#C49A00" },
    title: "Flashcard thông minh",
    desc: "Ôn tập theo lịch thông minh để ghi nhớ kiến thức tốt hơn và duy trì thói quen học mỗi ngày.",
  },
  {
    emoji: "🤖",
    color: { bg: "#FFECEC", text: "#FF6B6B" },
    title: "AI Study Coach",
    desc: "Hỗ trợ giải đáp, phân tích kết quả học tập và đề xuất nội dung ôn tập phù hợp.",
  },
  {
    emoji: "📅",
    color: { bg: "#E8F4FD", text: "#4EA8DE" },
    title: "Đếm ngược THPT",
    desc: "Theo dõi thời gian còn lại đến kỳ thi và lên kế hoạch ôn tập rõ ràng hơn.",
  },
  {
    emoji: "📊",
    color: { bg: "#E1F5EE", text: "#06D6A0" },
    title: "Xem lại kết quả",
    desc: "Xem điểm, số câu đúng và thông tin kết quả sau khi hoàn thành bài thi.",
  },
];

const TEACHER_FEATURES = [
  {
    emoji: "✍️",
    color: { bg: "#EEEFFE", text: "#6C63FF" },
    title: "Tạo đề trên một màn hình",
    desc: "Soạn câu hỏi trực tiếp, chỉnh sửa nhanh hoặc import PDF/Word rồi tiếp tục hoàn thiện trước khi xuất bản.",
  },
  {
    emoji: "🏫",
    color: { bg: "#FFF8E1", text: "#C49A00" },
    title: "Quản lý lớp học",
    desc: "Tạo lớp, quản lý học sinh và giao đề trực tiếp cho lớp. Học sinh có thể tham gia bằng tài khoản hoặc guest tùy cấu hình đề.",
  },
  {
    emoji: "📈",
    color: { bg: "#FFECEC", text: "#FF6B6B" },
    title: "Thống kê kết quả",
    desc: "Xem bài nộp, điểm trung bình, phân bố điểm và kết quả của học sinh theo từng đề.",
  },
];

export function Features() {
  return (
    <section id="tinh-nang" style={{ background: "#F8F7FF" }} className="py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-5">

        <div className="text-center mb-12">
          <span className="inline-block text-sm font-bold px-3 py-1 rounded-full mb-3"
            style={{ background: "#EEEFFE", color: "#6C63FF" }}>
            Dành cho học sinh
          </span>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#1A1523" }}>
            Học và kiểm tra thuận tiện hơn
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-16">
          {STUDENT_FEATURES.map((f) => (
            <div key={f.title}
              className="rounded-2xl p-5 transition-transform hover:-translate-y-1"
              style={{ background: "white", border: "1px solid #E8E4FF" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3"
                style={{ background: f.color.bg }}>
                {f.emoji}
              </div>
              <h3 className="font-black mb-1.5" style={{ color: "#1A1523" }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mb-12">
          <span className="inline-block text-sm font-bold px-3 py-1 rounded-full mb-3"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}>
            Dành cho giáo viên
          </span>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#1A1523" }}>
            Tạo đề và quản lý lớp học dễ dàng
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {TEACHER_FEATURES.map((f) => (
            <div key={f.title}
              className="rounded-2xl p-5 transition-transform hover:-translate-y-1"
              style={{ background: "white", border: "1px solid #E8E4FF" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3"
                style={{ background: f.color.bg }}>
                {f.emoji}
              </div>
              <h3 className="font-black mb-1.5" style={{ color: "#1A1523" }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
