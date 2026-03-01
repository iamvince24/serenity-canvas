import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { CanvasRouteGuard } from "./components/auth/CanvasRouteGuard";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LOCAL_BOARD_ID } from "./features/canvas/core/constants";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { useAuthStore } from "./stores/authStore";

function App() {
  useEffect(() => {
    void useAuthStore.getState().initialize();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/canvas"
        element={<Navigate to={`/canvas/${LOCAL_BOARD_ID}`} replace />}
      />
      <Route path="/canvas/:id" element={<CanvasRouteGuard />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
