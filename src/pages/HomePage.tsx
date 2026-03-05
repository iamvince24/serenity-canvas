import { Link, Navigate } from "react-router";
import { LOCAL_BOARD_ID } from "../features/canvas/core/constants";
import { Header } from "../components/layout/Header";
import { useAuthStore } from "../stores/authStore";

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#C9D3C4] border-t-[#708067]" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

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
            在寧靜中釐清思緒
          </h1>

          <p className="text-body animate-serenity-in animation-delay-80 mt-6 max-w-xl text-foreground-muted">
            Serenity Canvas
            透過安靜、層次分明的工作空間，幫助你將零散的想法轉化為清晰的方向。
          </p>

          <Link
            to={`/canvas/${LOCAL_BOARD_ID}`}
            className="btn-primary animate-serenity-in animation-delay-160 mt-10"
          >
            開始使用
          </Link>
        </section>
      </main>
    </div>
  );
}
