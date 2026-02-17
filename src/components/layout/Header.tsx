import { Link } from "react-router";

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[#F0EEEA] bg-[rgba(250,250,248,0.9)] backdrop-blur-[12px] transition-all duration-300 ease-in-out">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="text-[1.125rem] font-medium tracking-[-0.015em] text-[#1C1C1A] transition-colors duration-300 ease-in-out hover:text-[#5E6E58]"
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
