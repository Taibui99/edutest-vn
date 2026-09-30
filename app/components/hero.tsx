import Link from "next/link";
import { auth } from "@/auth";

export async function Hero() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem-1px)] max-w-3xl flex-col justify-center px-5 py-16">
      <h1
        className="text-3xl font-black tracking-tight sm:text-4xl"
        style={{ color: "var(--text-primary)", lineHeight: 1.25 }}
      >
        Soạn đề thi và chấm bài trực tuyếp.
      </h1>

      <p className="mt-4 max-w-xl text-base sm:text-lg" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
        Giáo viên soạn và giao đề trong vài phút. Học sinh làm bài bằng mã, không cần tài khoản.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={isLoggedIn ? "/bang-dieu-khien/tao-de-thi" : "/dang-ky"}
          className="inline-flex h-12 items-center justify-center rounded-2xl px-7 text-base font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--primary)" }}
        >
          {isLoggedIn ? "Tạo đề thi" : "Tạo tài khoản giáo viên"}
        </Link>
        <Link
          href="/vao-thi"
          className="inline-flex h-12 items-center justify-center rounded-2xl px-7 text-base font-semibold transition-colors"
          style={{ border: "1.5px solid var(--surface-border-strong)", color: "var(--primary)", background: "var(--surface-card)" }}
        >
          Vào thi bằng mã
        </Link>
      </div>
    </section>
  );
}