<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:edutest-workflow -->
# EduTest workflow — BẮT BUỘC đọc mỗi phiên

1. **Đọc `ROADMAP.md` TRƯỚC khi làm bất kỳ việc gì** — nó là nguồn duy nhất về tiến độ. Xác định hạng mục đang cần làm (mục đầu tiên còn `[ ]` theo thứ tự ưu tiên), và double-check không có mục nào bị bỏ sót.
2. **Cập nhật `ROADMAP.md` + todo list song song**:
   - Đánh dấu `[x]` hạng mục sau khi THỰC SỰ xong: code + build/tsc pass + verify live (nếu được) + push. Không đánh dấu sớm.
   - Mỗi hạng mục `[x]` thêm commit hash vào ngoặc.
3. **Trước khi bắt đầu hạng mục mới**: đọc lại `ROADMAP.md`, xác nhận hạng mục kế tiếp, báo user hôm nay làm gì.
4. **Sau mỗi hạng mục hoàn thành**: commit riêng (thêm dòng "docs: cập nhật ROADMAP" nếu chỉ sửa checklist).
5. Nếu user thêm việc mới → ghi vào `ROADMAP.md` đúng nhóm (P0/P1/P2/P3/Nhỏ/Kỹ thuật) trước khi làm.
<!-- END:edutest-workflow -->
