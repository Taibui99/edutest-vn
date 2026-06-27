import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Features } from "./components/features";
import { Footer } from "./components/footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <section
          id="huong-dan"
          className="bg-gradient-to-r from-blue-600 to-blue-700 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Sẵn sàng bắt đầu?
            </h2>
            <p className="mt-4 text-lg text-blue-100">
              Tạo tài khoản miễn phí và trải nghiệm ngay hôm nay. Không cần cài
              đặt, sử dụng trên trình duyệt.
            </p>
            <a
              href="/dang-ky"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 text-base font-semibold text-blue-700 shadow-md transition-colors hover:bg-blue-50"
            >
              Đăng ký miễn phí
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
