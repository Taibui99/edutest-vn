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
      <body style={{ margin: 0,   fontFamily: "Be Vietnam Pro, sans-serif", background: "#F6F5FB", color: "#1C1917" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#B97F10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
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
                background: "#6C4CF1",
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