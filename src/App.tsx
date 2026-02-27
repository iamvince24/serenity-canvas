import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { useDashboardStore } from "./stores/dashboardStore";

function CaptureCanvasRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      useDashboardStore.getState().setActiveBoardId(id);
    }
    navigate("/dashboard", { replace: true });
  }, [id, navigate]);

  return null;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/canvas" element={<Navigate to="/dashboard" replace />} />
      <Route path="/canvas/:id" element={<CaptureCanvasRedirect />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}

export default App;
