import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Footer } from "./components/footer";

export default async function Home() {
  try {
    const session = await auth();
    if (session?.user) redirect("/bang-dieu-khien");
  } catch {}

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Hero />
      </main>
      <Footer />
    </>
  );
}