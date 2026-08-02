import { useEffect, useState } from "react";
import { EmptyState, StatCard } from "@stock-c/ui";
import type { DashboardSummary } from "@stock-c/shared-types";
import { useAuth } from "../features/auth/AuthContext";
import { fetchDashboardSummary } from "../features/dashboard/api";

export function DashboardPage() {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    fetchDashboardSummary(accessToken)
      .then(setSummary)
      .catch(() => setError(true));
  }, [accessToken]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sucursales" value={summary?.branchCount} />
        <StatCard label="Usuarios del equipo" value={summary?.activeUserCount} />
        <StatCard label="Productos activos" emptyReason="Se activa en la Fase 7" />
        <StatCard label="Stock bajo" emptyReason="Se activa en la Fase 9" />
        <StatCard label="Movimientos hoy" emptyReason="Se activa en la Fase 9" />
      </div>

      {error && (
        <p className="text-sm text-danger">
          No se pudieron cargar los indicadores. Probá recargar la página.
        </p>
      )}

      <div>
        <h2 className="mb-2.5 text-[15px] font-semibold">Movimientos recientes</h2>
        <EmptyState
          glyph="📦"
          title="Sin movimientos aún"
          description="Los ingresos y salidas de stock van a aparecer acá a partir de la Fase 9."
        />
      </div>
    </div>
  );
}
