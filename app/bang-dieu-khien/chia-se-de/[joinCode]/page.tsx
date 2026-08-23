"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Check, Copy, Download, ExternalLink, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareData {
  exam: {
    title: string;
    subject: string;
    durationMinutes: number;
    questionCount: number;
    status: string;
  };
  shareUrl: string;
  qrUrl: string;
}

export default function ShareExamPage() {
  const params = useParams<{ joinCode: string }>();
  const router = useRouter();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"link" | null>(null);

  useEffect(() => {
    const code = params.joinCode;
    if (!code) return;
    fetch(`/api/exams/share/${encodeURIComponent(code)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Không thể tải thông tin chia sẻ");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không thể tải thông tin chia sẻ"));
  }, [params.joinCode]);

  const copyLink = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.shareUrl);
    setCopied("link");
    window.setTimeout(() => setCopied(null), 1800);
  };

  const downloadQr = async () => {
    if (!data) return;
    const response = await fetch(data.qrUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edutest-${params.joinCode}-qr.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nativeShare = async () => {
    if (!data) return;
    if (navigator.share) {
      await navigator.share({ title: data.exam.title, text: "Tham gia bài kiểm tra trên EduTest.vn", url: data.shareUrl });
      return;
    }
    await copyLink();
  };

  if (error) {
    return <div className="min-h-screen grid place-items-center p-6 text-sm text-[#E14D4D]">{error}</div>;
  }

  if (!data) {
    return <div className="min-h-screen grid place-items-center text-sm text-[var(--text-muted)]">Đang chuẩn bị link tham gia...</div>;
  }

  const previewUrl = `${data.shareUrl}${data.shareUrl.includes("?") ? "&" : "?"}preview=1`;

  return (
    <main className="min-h-screen bg-[var(--surface-page)] px-4 py-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => router.push("/bang-dieu-khien")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={16} /> Quay lại bảng điều khiển
        </button>

        <section className="overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-sm">
          <div className="border-b border-[var(--surface-border)] p-6 text-center lg:p-8">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
              <QrCode size={24} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Đề thi đã sẵn sàng</p>
            <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{data.exam.title}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{data.exam.subject} · {data.exam.questionCount} câu · {data.exam.durationMinutes} phút</p>
          </div>

          <div className="grid gap-7 p-6 lg:grid-cols-[280px_1fr] lg:p-8">
            <div className="mx-auto w-full max-w-[280px] rounded-2xl border border-[var(--surface-border)] bg-white p-3 shadow-sm">
              <Image src={data.qrUrl} alt={`QR tham gia ${data.exam.title}`} width={280} height={280} unoptimized className="block aspect-square w-full" />
            </div>

            <div className="flex min-w-0 flex-col justify-center">
              <h2 className="text-lg font-black text-[var(--text-primary)]">Chia sẻ cho học sinh</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Học sinh chỉ cần quét QR hoặc mở link. Không cần nhớ mã đề.</p>

              <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Link tham gia</p>
                <div className="flex items-center gap-2">
                  <input readOnly value={data.shareUrl} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none" />
                  <button type="button" onClick={copyLink} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-card)] text-[var(--primary)] shadow-sm hover:bg-[var(--primary-light)]" aria-label="Sao chép link">
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Button onClick={copyLink} variant="outline" icon={copied ? <Check size={16} /> : <Copy size={16} />}>{copied ? "Đã sao chép" : "Sao chép link"}</Button>
                <Button onClick={nativeShare} variant="outline" icon={<Share2 size={16} />}>Chia sẻ</Button>
                <Button onClick={downloadQr} variant="outline" icon={<Download size={16} />}>Tải QR</Button>
              </div>

              <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-light)] px-4 py-3 text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--primary-muted)]">
                Mở thử trang học sinh <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
