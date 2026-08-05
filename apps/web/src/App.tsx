import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeContext";
import { AuthProvider } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { AppShell } from "./app/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { CatalogsPage } from "./pages/CatalogsPage";
import { MovementsPage } from "./pages/MovementsPage";
import { ComingSoon } from "./pages/ComingSoon";

export function App() {
  return (
    <ThemeProvider>
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
              <Route path="/productos" element={<ProductsPage />} />
              <Route path="/categorias" element={<CatalogsPage />} />
              <Route path="/movimientos" element={<MovementsPage />} />
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
    </ThemeProvider>
  );
}
