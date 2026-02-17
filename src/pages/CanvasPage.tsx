import { Link } from "react-router";

export function CanvasPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFAF8] px-6 text-center text-[#1C1C1A]">
      <p
        className="text-sm tracking-[0.08em] text-[#6B6B66]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Canvas - Coming Soon
      </p>
      <Link
        to="/"
        className="text-sm text-[#5E6E58] transition-colors duration-300 ease-in-out hover:text-[#1C1C1A]"
      >
        Back to Home
      </Link>
    </main>
  );
}
