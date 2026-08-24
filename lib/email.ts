interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

const FROM_DEFAULT = "EduTest <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || FROM_DEFAULT;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[email] RESEND_API_KEY chưa đặt — bỏ qua gửi email (dev mode)");
    } else {
      console.error("[email] RESEND_API_KEY chưa đặt ở production — KHÔNG gửi được email");
    }
    return { sent: false, reason: "missing_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend ${res.status}: ${body.slice(0, 300)}`);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] Gửi thất bại:", (e as Error).message);
    return { sent: false, reason: "network_error" };
  }
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: "Đặt lại mật khẩu EduTest",
    html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1F2937">
  <p style="font-size:14px">Xin chào <strong>${name}</strong>,</p>
  <p style="font-size:14px;line-height:1.6">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản EduTest của bạn. Nhấn nút bên dưới để chọn mật khẩu mới:</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${resetUrl}" style="background:#6C4CF1;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:12px;display:inline-block">Đặt lại mật khẩu</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#6B7280">Nếu nút không hoạt động, sao chép đường dẫn này vào trình duyệt:<br><a href="${resetUrl}" style="color:#6C4CF1;word-break:break-all">${resetUrl}</a></p>
  <p style="font-size:13px;line-height:1.6;color:#6B7280">Liên kết có hiệu lực trong <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.</p>
  <hr style="border:none;border-top:1px solid #E7E5E0;margin:20px 0" />
  <p style="font-size:12px;color:#9CA3AF">EduTest — Tạo đề thi &amp; kiểm tra trực tuyến</p>
</div>`,
  };
}
