import { Link } from "react-router";

export function Header() {
  return (
    <header className="nav-calm fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="text-[1.125rem] font-medium tracking-[-0.015em] text-foreground transition-colors duration-300 ease-in-out hover:text-sage-dark"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Serenity Canvas
        </Link>
        <Link to="/canvas" className="btn-primary">
          Try Now
        </Link>
      </div>
    </header>
  );
}
