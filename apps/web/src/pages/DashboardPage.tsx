import { useEffect, useState } from "react";
import { Badge, EmptyState, StatCard, Table, Td, Th } from "@stock-c/ui";
import type { DashboardSummary, StockMovementType } from "@stock-c/shared-types";
import { useAuth } from "../features/auth/AuthContext";
import { fetchDashboardSummary } from "../features/dashboard/api";

function formatQty(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 4 }) : value;
}

const TYPE_LABEL: Record<StockMovementType, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

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
        <StatCard label="Productos activos" value={summary?.productCount} />
        <StatCard label="Stock bajo" value={summary?.lowStockCount} />
        <StatCard label="Movimientos hoy" value={summary?.movementsTodayCount} />
      </div>

      {error && (
        <p className="text-sm text-danger">
          No se pudieron cargar los indicadores. Probá recargar la página.
        </p>
      )}

      <div>
        <h2 className="mb-2.5 text-[15px] font-semibold">Movimientos recientes</h2>
        {summary && summary.recentMovements.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Producto</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Cantidad</Th>
              </tr>
            </thead>
            <tbody>
              {summary.recentMovements.map((m) => (
                <tr key={m.id}>
                  <Td className="text-text-tertiary">{new Date(m.createdAt).toLocaleString("es-AR")}</Td>
                  <Td className="font-medium">{m.productName}</Td>
                  <Td>
                    <Badge variant={m.type === "salida" ? "warning" : "success"}>{TYPE_LABEL[m.type]}</Badge>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{formatQty(m.quantity)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            glyph="📦"
            title="Sin movimientos aún"
            description="Registrá el primero desde la sección Movimientos."
          />
        )}
      </div>
    </div>
  );
}
