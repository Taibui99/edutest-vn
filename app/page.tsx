import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Footer } from "./components/footer";

export default async function Home() {
  const session = await getSession();
  if (session?.user) redirect("/bang-dieu-khien");

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