import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Chính sách bảo mật — EduTest",
  description: "Chính sách bảo mật thông tin người dùng của EduTest",
};

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. Thông tin chúng tôi thu thập",
    items: [
      "Thông tin tài khoản: họ tên, email, trường, khối (tùy chọn), vai trò (giáo viên/học sinh).",
      "Dữ liệu học tập: bài nộp, điểm số, tiến độ ôn tập, flashcard và hoạt động học.",
      "Dữ liệu kỹ thuật: địa chỉ IP, thời gian đăng nhập — phục vụ bảo mật và chống gian lận thi.",
    ],
  },
  {
    title: "2. Mục đích sử dụng",
    items: [
      "Vận hành nền tảng: tạo đề, giao thi, chấm điểm, hiển thị kết quả cho đúng người.",
      "Bảo vệ kỳ thi: phát hiện hành vi gian lận (rời trang, mở tab trái phép) khi giáo viên bật tính năng này.",
      "Hỗ trợ tài khoản: gửi email đặt lại mật khẩu, thông báo quan trọng về tài khoản.",
    ],
  },
  {
    title: "3. Chia sẻ dữ liệu",
    items: [
      "Chúng tôi KHÔNG bán dữ liệu cá nhân cho bên thứ ba.",
      "Kết quả bài thi chỉ hiển thị với: học sinh đó, giáo viên sở hữu đề, và quản trị viên hệ thống khi xử lý vi phạm.",
      "Nhà cung cấp hạ tầng (hosting, cơ sở dữ liệu, email) chỉ được truy cập dữ liệu ở mức cần thiết để vận hành dịch vụ.",
    ],
  },
  {
    title: "4. Bảo vệ dữ liệu trẻ em",
    items: [
      "EduTest dành cho mục đích giáo dục và tôn trọng quyền riêng tư của học sinh. Dữ liệu học sinh được thu thập tối thiểu, chỉ phục vụ việc dạy và học.",
      "Phụ huynh/người giám hộ có thể yêu cầu xem hoặc xóa thông tin của con em thông qua giáo viên hoặc kênh hỗ trợ.",
    ],
  },
  {
    title: "5. Lưu trữ và xóa dữ liệu",
    items: [
      "Tài khoản bị xóa sẽ chuyển sang trạng thái đã xóa; dữ liệu cá nhân được vô hiệu hóa theo chính sách lưu trữ nội bộ.",
      "Bạn có thể yêu cầu xóa tài khoản bất cứ lúc nào qua trang hồ sơ hoặc kênh hỗ trợ.",
    ],
  },
  {
    title: "6. Quyền của bạn",
    items: [
      "Xem, sửa thông tin cá nhân trong trang Hồ sơ.",
      "Yêu cầu xuất hoặc xóa dữ liệu cá nhân.",
      "Khiếu nại về xử lý dữ liệu qua kênh hỗ trợ của EduTest.",
    ],
  },
];

export default function BaoMatPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6C4CF1] hover:text-[#5A3BD8] mb-8">
          <ArrowLeft size={15} /> Về trang chủ
        </Link>
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Chính sách bảo mật</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">Cập nhật lần cuối: 24/08/2026</p>
        <div className="flex flex-col gap-7">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-2.5">{s.title}</h2>
              <ul className="flex flex-col gap-2">
                {s.items.map((item, i) => (
                  <li key={i} className="text-sm leading-relaxed text-[var(--text-secondary)] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[#6C4CF1]">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
