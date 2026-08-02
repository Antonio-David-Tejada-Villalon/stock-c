import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { AppShell } from "./app/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ComingSoon } from "./pages/ComingSoon";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route
              path="/productos"
              element={<ComingSoon title="Productos" phase="Fase 7" />}
            />
            <Route
              path="/movimientos"
              element={<ComingSoon title="Movimientos" phase="Fase 9" />}
            />
            <Route path="/reportes" element={<ComingSoon title="Reportes" phase="Fase 11" />} />
            <Route
              path="/configuracion"
              element={<ComingSoon title="Configuración" phase="Fase 13" />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
