import { useEffect, useState } from "react";
import { EmptyState, Table, Td, Th } from "@stock-c/ui";
import type { InventoryValuationReport } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { getInventoryValuation } from "./api";
import { CsvDownloadButton } from "./CsvDownloadButton";
import { formatMoney, formatQty } from "./format";

export function InventoryValuationPanel() {
  const { accessToken } = useAuth();
  const [report, setReport] = useState<InventoryValuationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getInventoryValuation(accessToken)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <p className="text-sm text-text-secondary">Cargando…</p>;
  if (!report) return null;

  if (report.items.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay nada para valorizar"
        description="Cargá costo a tus productos y stock por Movimientos para ver este reporte."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border border-border bg-bg-raised px-4 py-3">
        <div>
          <div className="text-xs text-text-tertiary">Valor total del inventario</div>
          <div className="text-xl font-semibold tabular-nums">${formatMoney(report.grandTotal)}</div>
        </div>
        {report.excludedCount > 0 && (
          <p className="max-w-xs text-right text-xs text-text-tertiary">
            {report.excludedCount} producto{report.excludedCount === 1 ? "" : "s"} activo
            {report.excludedCount === 1 ? "" : "s"} sin costo cargado — no {report.excludedCount === 1 ? "entra" : "entran"} en
            este total.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <GroupTable title="Por categoría" groups={report.byCategory} />
        <GroupTable title="Por marca" groups={report.byBrand} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Detalle por producto</h3>
          <CsvDownloadButton
            filename="valorizacion-inventario.csv"
            rows={report.items}
            columns={[
              { header: "SKU", value: (r) => r.sku },
              { header: "Producto", value: (r) => r.name },
              { header: "Cantidad", value: (r) => r.quantity },
              { header: "Costo", value: (r) => r.cost },
              { header: "Valor", value: (r) => r.value },
            ]}
          />
        </div>
        <Table>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Producto</Th>
              <Th className="text-right">Cantidad</Th>
              <Th className="text-right">Costo</Th>
              <Th className="text-right">Valor</Th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((item) => (
              <tr key={item.productId} className="hover:bg-bg-sunken">
                <Td className="font-mono text-xs">{item.sku}</Td>
                <Td className="font-medium">{item.name}</Td>
                <Td className="text-right font-mono tabular-nums">{formatQty(item.quantity)}</Td>
                <Td className="text-right font-mono tabular-nums">${formatMoney(item.cost)}</Td>
                <Td className="text-right font-mono tabular-nums">${formatMoney(item.value)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function GroupTable({ title, groups }: { title: string; groups: InventoryValuationReport["byCategory"] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Table>
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th className="text-right">Cantidad</Th>
            <Th className="text-right">Valor</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id} className="hover:bg-bg-sunken">
              <Td className="font-medium">{g.name}</Td>
              <Td className="text-right font-mono tabular-nums">{formatQty(g.totalQuantity)}</Td>
              <Td className="text-right font-mono tabular-nums">${formatMoney(g.totalValue)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
