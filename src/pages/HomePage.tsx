import { Link } from "react-router";
import { Header } from "../components/layout/Header";

export function HomePage() {
  return (
    <div className="layered-calm-bg relative min-h-screen overflow-hidden text-foreground">
      <Header />

      <div aria-hidden className="layered-calm-wash" />
      <div aria-hidden className="layered-calm-mask" />

      <main className="relative z-10 mt-14 flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
        <section className="mx-auto flex max-w-3xl -translate-y-12 flex-col items-center text-center md:-translate-y-16">
          <h1
            className="animate-serenity-in text-[clamp(2.25rem,6vw,3rem)] font-normal leading-[1.16] tracking-[-0.025em]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Find Clarity in Calm
          </h1>

          <p className="text-body animate-serenity-in animation-delay-80 mt-6 max-w-xl text-foreground-muted">
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
