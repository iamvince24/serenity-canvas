import { Link } from "react-router";
import { Canvas } from "../features/canvas/Canvas";
import { Toolbar } from "../features/canvas/Toolbar";

export function CanvasPage() {
  return (
    // Canvas fills full viewport; toolbar and back button float above it.
    <main className="relative min-h-screen w-full overflow-hidden bg-canvas">
      <Canvas />
      <Toolbar />

      <Link
        to="/"
        className="btn-ghost fixed left-4 top-4 z-40 md:left-6 md:top-6"
      >
        Back to Home
      </Link>
    </main>
  );
}
