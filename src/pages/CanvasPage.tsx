import { Link } from "react-router";

export function CanvasPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center text-foreground">
      <p
        className="text-mono-label text-foreground-muted"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Canvas - Coming Soon
      </p>
      <Link
        to="/"
        className="text-body-sm text-sage-dark transition-colors duration-300 ease-in-out hover:text-foreground"
      >
        Back to Home
      </Link>
    </main>
  );
}
