import { useEffect, useState } from "react";
import { Table, Td, Th } from "@stock-c/ui";
import type { CatalogSummaryReport } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { getCatalogSummary } from "./api";
import { CsvDownloadButton } from "./CsvDownloadButton";
import { formatQty } from "./format";

export function CatalogSummaryPanel() {
  const { accessToken } = useAuth();
  const [report, setReport] = useState<CatalogSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getCatalogSummary(accessToken)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <p className="text-sm text-text-secondary">Cargando…</p>;
  if (!report) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border border-border bg-bg-raised px-4 py-3">
          <div className="text-xs text-text-tertiary">Productos activos</div>
          <div className="text-xl font-semibold tabular-nums">{report.totalActiveProducts}</div>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-bg-raised px-4 py-3">
          <div className="text-xs text-text-tertiary">Productos inactivos</div>
          <div className="text-xl font-semibold tabular-nums">{report.totalInactiveProducts}</div>
        </div>
      </div>

      <GroupSection title="Por categoría" filename="resumen-categorias.csv" groups={report.byCategory} />
      <GroupSection title="Por marca" filename="resumen-marcas.csv" groups={report.byBrand} />
    </div>
  );
}

function GroupSection({
  title,
  filename,
  groups,
}: {
  title: string;
  filename: string;
  groups: CatalogSummaryReport["byCategory"];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <CsvDownloadButton
          filename={filename}
          rows={groups}
          columns={[
            { header: "Nombre", value: (g) => g.name },
            { header: "Productos activos", value: (g) => g.activeCount },
            { header: "Stock total", value: (g) => g.totalStock },
          ]}
        />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th className="text-right">Productos activos</Th>
            <Th className="text-right">Stock total</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id} className="hover:bg-bg-sunken">
              <Td className="font-medium">{g.name}</Td>
              <Td className="text-right font-mono tabular-nums">{g.activeCount}</Td>
              <Td className="text-right font-mono tabular-nums">{formatQty(g.totalStock)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
