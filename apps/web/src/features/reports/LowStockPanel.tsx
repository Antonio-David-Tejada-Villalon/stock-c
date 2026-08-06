import { useEffect, useState } from "react";
import { Badge, EmptyState, Table, Td, Th } from "@stock-c/ui";
import type { LowStockReport } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { getLowStock } from "./api";
import { CsvDownloadButton } from "./CsvDownloadButton";
import { formatQty } from "./format";

export function LowStockPanel() {
  const { accessToken } = useAuth();
  const [report, setReport] = useState<LowStockReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getLowStock(accessToken)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <p className="text-sm text-text-secondary">Cargando…</p>;
  if (!report) return null;

  if (report.items.length === 0) {
    return (
      <EmptyState
        title="Sin productos bajo el umbral"
        description="Ningún producto con stock mínimo cargado está por debajo de él ahora mismo. Si esperabas ver algo acá, cargá el umbral en Productos → Stock mínimo."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {report.items.length} producto{report.items.length === 1 ? "" : "s"} por debajo de su stock mínimo.
        </p>
        <CsvDownloadButton
          filename="stock-bajo.csv"
          rows={report.items}
          columns={[
            { header: "SKU", value: (r) => r.sku },
            { header: "Producto", value: (r) => r.name },
            { header: "Stock actual", value: (r) => r.quantity },
            { header: "Stock mínimo", value: (r) => r.minStock },
            { header: "Déficit", value: (r) => r.deficit },
          ]}
        />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Producto</Th>
            <Th className="text-right">Stock actual</Th>
            <Th className="text-right">Stock mínimo</Th>
            <Th className="text-right">Déficit</Th>
          </tr>
        </thead>
        <tbody>
          {report.items.map((item) => (
            <tr key={item.productId} className="hover:bg-bg-sunken">
              <Td className="font-mono text-xs">{item.sku}</Td>
              <Td className="font-medium">{item.name}</Td>
              <Td className="text-right font-mono tabular-nums">{formatQty(item.quantity)}</Td>
              <Td className="text-right font-mono tabular-nums">{formatQty(item.minStock)}</Td>
              <Td className="text-right">
                <Badge variant="danger">{formatQty(item.deficit)}</Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
