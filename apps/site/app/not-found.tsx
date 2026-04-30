import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h2>404 — Page Not Found</h2>
      <p>The page you were looking for does not exist.</p>
      <Link href="/">Go home</Link>
    </main>
  );
}
