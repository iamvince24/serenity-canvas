import { Link } from "react-router";
import { Header } from "../components/layout/Header";

export function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAFAF8] text-[#1C1C1A]">
      <Header />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[#8B9D8312]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh] bg-[linear-gradient(to_bottom,transparent,#FAFAF8_90%)]"
      />

      <main className="relative z-10 mt-14 flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
        <section className="mx-auto flex max-w-3xl -translate-y-12 flex-col items-center text-center md:-translate-y-16">
          <h1
            className="animate-serenity-in text-[clamp(2.25rem,6vw,3rem)] font-normal leading-[1.16] tracking-[-0.025em]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Find Clarity in Calm
          </h1>

          <p className="animate-serenity-in animation-delay-80 mt-6 max-w-xl text-base leading-[1.625] text-[#6B6B66]">
            Serenity Canvas helps you turn scattered ideas into clear direction
            through a quiet, layered workspace.
          </p>

          <Link
            to="/canvas"
            className="btn-primary animate-serenity-in animation-delay-160 mt-10"
          >
            Get Started
          </Link>
        </section>
      </main>
    </div>
  );
}
