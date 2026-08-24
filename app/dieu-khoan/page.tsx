import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng — EduTest",
  description: "Điều khoản sử dụng nền tảng EduTest",
};

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. Chấp nhận điều khoản",
    items: [
      "Khi truy cập và sử dụng EduTest, bạn đồng ý tuân theo các điều khoản này. Nếu bạn không đồng ý, vui lòng ngừng sử dụng nền tảng.",
      "Giáo viên và học sinh cần có sự đồng ý của phụ huynh/người giám hộ nếu chưa đủ 14 tuổi theo quy định pháp luật Việt Nam.",
    ],
  },
  {
    title: "2. Tài khoản",
    items: [
      "Bạn chịu trách nhiệm bảo mật thông tin đăng nhập của mình. Mọi hoạt động diễn ra trên tài khoản được coi là do bạn thực hiện.",
      "Không mượn, cho mượn hoặc chia sẻ tài khoản cho người khác.",
      "Cung cấp thông tin chính xác khi đăng ký. EduTest có thể tạm khóa tài khoản có dấu hiệu gian lận, spam hoặc vi phạm điều khoản.",
    ],
  },
  {
    title: "3. Sử dụng hợp lệ",
    items: [
      "Chỉ tạo nội dung thi/kiểm tra phục vụ mục đích giáo dục. Nghĩa cấm: nội dung vi phạm thuần phong mỹ tục, xâm phạm quyền lợi người khác, chính trị nhạy cảm, mã độc.",
      "Không can thiệp, khai thác lỗ hổng, hoặc sử dụng công cụ tự động để thao túng hệ thống và kết quả bài thi.",
      "Không gian lận trong quá trình làm bài (chia sẻ đáp án, mở tab tra cứu khi bị cấm). Vi phạm có thể dẫn đến hủy kết quả và khóa tài khoản.",
    ],
  },
  {
    title: "4. Nội dung của giáo viên",
    items: [
      "Giáo viên sở hữu nội dung đề thi mình tạo và chịu trách nhiệm về tính chính xác, hợp pháp của nội dung đó.",
      "EduTest có quyền ẩn hoặc gỡ bỏ đề thi vi phạm khi phát hiện hoặc nhận báo cáo.",
    ],
  },
  {
    title: "5. Dịch vụ và thay đổi",
    items: [
      "EduTest được cung cấp theo trạng thái hiện có. Chúng tôi cố gắng giữ dịch vụ ổn định nhưng không đảm bảo không xảy ra gián đoạn.",
      "Chúng tôi có thể cập nhật điều khoản này; thay đổi quan trọng sẽ được thông báo trên nền tảng.",
    ],
  },
  {
    title: "6. Liên hệ",
    items: [
      "Mọi thắc mắc về điều khoản sử dụng, vui lòng liên hệ qua kênh hỗ trợ của EduTest.",
    ],
  },
];

export default function DieuKhoanPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6C4CF1] hover:text-[#5A3BD8] mb-8">
          <ArrowLeft size={15} /> Về trang chủ
        </Link>
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Điều khoản sử dụng</h1>
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
