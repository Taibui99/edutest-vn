"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "Nunito, sans-serif", background: "#F0EFFE", color: "#1E3230" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🚨</div>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>Lỗi nghiêm trọng</h1>
            <p style={{ fontSize: 14, color: "#6B6890", marginBottom: 20 }}>
              {error?.message || "Hệ thống gặp sự cố ngoài dự kiến."}
            </p>
            <button
              onClick={reset}
              style={{
                height: 40,
                padding: "0 24px",
                borderRadius: 12,
                border: "none",
                background: "#0F766E",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Thử lại
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}