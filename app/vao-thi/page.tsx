"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/app/components/logo";

export default function VaoThiPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      return;
    }

    router.push(`/thi/${normalizedCode}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-green-100 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <Link href="/bang-dieu-khien" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-green-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-green-600">Vào phòng thi</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Nhập mã tham gia</h1>
          <p className="mt-2 text-sm text-slate-600">
            Giáo viên sẽ cung cấp mã gồm 6 ký tự sau khi xuất bản đề thi.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="VD: ABC123"
              maxLength={8}
              className="h-14 w-full rounded-xl border border-slate-200 px-4 text-center text-2xl font-bold uppercase tracking-[0.25em] text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-green-600 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              Bắt đầu làm bài
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
