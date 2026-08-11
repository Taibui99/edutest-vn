const STUDENT_FEATURES = [
  {
    emoji: "📝",
    color: { bg: "#EEEFFE", text: "#6C63FF" },
    title: "Vào thi bằng mã",
    desc: "Nhập mã đề từ giáo viên, làm bài ngay — không cần tài khoản phức tạp.",
  },
  {
    emoji: "⏱️",
    color: { bg: "#E1F5EE", text: "#06D6A0" },
    title: "Timer + tự nộp bài",
    desc: "Đồng hồ đếm ngược, tự động nộp khi hết giờ. Kết quả hiện ngay sau khi nộp.",
  },
  {
    emoji: "🃏",
    color: { bg: "#FFF8E1", text: "#C49A00" },
    title: "Flashcard thông minh",
    desc: "Thuật toán SM-2 tự động sắp xếp thẻ cần ôn mỗi ngày. Càng dùng càng thông minh.",
  },
  {
    emoji: "🤖",
    color: { bg: "#FFECEC", text: "#FF6B6B" },
    title: "AI Study Coach",
    desc: "Phân tích điểm yếu của bạn, đề xuất ôn tập cụ thể dựa trên kết quả thực tế.",
  },
  {
    emoji: "📅",
    color: { bg: "#E8F4FD", text: "#4EA8DE" },
    title: "Đếm ngược THPT",
    desc: "Biết chính xác còn bao nhiêu ngày đến kỳ thi. Lên kế hoạch ôn tập rõ ràng hơn.",
  },
  {
    emoji: "📊",
    color: { bg: "#E1F5EE", text: "#06D6A0" },
    title: "Xem lại đáp án",
    desc: "Sau mỗi bài thi, xem lại từng câu, đáp án đúng và giải thích chi tiết.",
  },
];

const TEACHER_FEATURES = [
  {
    emoji: "✍️",
    color: { bg: "#EEEFFE", text: "#6C63FF" },
    title: "Tạo đề 5 bước",
    desc: "Thêm câu hỏi thủ công hoặc import từ PDF/Word. Có preview trước khi xuất bản.",
  },
  {
    emoji: "🏫",
    color: { bg: "#FFF8E1", text: "#C49A00" },
    title: "Quản lý lớp học",
    desc: "Tạo lớp, chia sẻ mã, quản lý học sinh. Giao đề thi trực tiếp vào lớp.",
  },
  {
    emoji: "📈",
    color: { bg: "#FFECEC", text: "#FF6B6B" },
    title: "Thống kê lớp",
    desc: "Xem điểm trung bình, phân bố điểm, bài nộp theo ngày. Biết lớp đang học tốt không.",
  },
];

export function Features() {
  return (
    <section id="tinh-nang" style={{ background: "#F8F7FF" }} className="py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-5">

        {/* Student section */}
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-bold px-3 py-1 rounded-full mb-3"
            style={{ background: "#EEEFFE", color: "#6C63FF" }}>
            Dành cho học sinh
          </span>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#1A1523" }}>
            Học thông minh hơn mỗi ngày
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
              <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Teacher section */}
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-bold px-3 py-1 rounded-full mb-3"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}>
            Dành cho giáo viên
          </span>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: "#1A1523" }}>
            Quản lý lớp học dễ dàng
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
              <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
