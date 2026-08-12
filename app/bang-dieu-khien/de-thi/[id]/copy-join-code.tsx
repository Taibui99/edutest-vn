"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyJoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={copyCode}
      title="Sao chép mã đề thi"
      aria-label={`Sao chép mã đề thi ${code}`}
      className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/20 text-white text-sm font-mono font-black hover:bg-white/30 active:scale-[0.98] transition-all cursor-pointer"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? "Đã sao chép" : code}</span>
      <span className="text-[11px] font-sans font-semibold text-white/70 group-hover:text-white/90">
        {copied ? "" : "Sao chép"}
      </span>
    </button>
  );
}
