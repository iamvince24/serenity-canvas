import { Route, Routes } from "react-router";
import { CanvasPage } from "./pages/CanvasPage";
import { HomePage } from "./pages/HomePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/canvas" element={<CanvasPage />} />
    </Routes>
  );
}

export default App;
