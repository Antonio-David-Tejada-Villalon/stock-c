import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, FormField, Input, Select, Table, Td, Th } from "@stock-c/ui";
import type { Category, MovementsReport, StockMovementType } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { listCategories } from "../catalogs/api";
import { getMovementsReport } from "./api";
import { CsvDownloadButton } from "./CsvDownloadButton";
import { formatQty } from "./format";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const TYPE_LABEL: Record<StockMovementType, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

export function MovementsReportPanel() {
  const { accessToken } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(30));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [type, setType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [report, setReport] = useState<MovementsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) void listCategories(accessToken).then((res) => setCategories(res.items));
  }, [accessToken]);

  const runReport = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMovementsReport(accessToken, {
        dateFrom,
        dateTo,
        type: type ? (type as StockMovementType) : undefined,
        categoryId: categoryId || undefined,
      });
      setReport(res);
    } catch {
      setError("No se pudo generar el reporte. Revisá el rango de fechas.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, dateFrom, dateTo, type, categoryId]);

  useEffect(() => {
    // Solo al montar, con los defaults — después el usuario dispara con
    // "Aplicar filtros" (fetch en cada tecleo sería ruidoso acá).
    void runReport();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4 rounded-lg border border-border bg-bg-raised p-4">
        <FormField label="Desde" htmlFor="mr-from">
          <Input id="mr-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </FormField>
        <FormField label="Hasta" htmlFor="mr-to">
          <Input id="mr-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </FormField>
        <FormField label="Tipo" htmlFor="mr-type">
          <Select id="mr-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </Select>
        </FormField>
        <FormField label="Categoría" htmlFor="mr-category">
          <Select id="mr-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="col-span-4 flex justify-end">
          <Button type="button" size="sm" onClick={() => void runReport()} disabled={loading}>
            {loading ? "Buscando…" : "Aplicar filtros"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {report && report.items.length === 0 && !loading && (
        <EmptyState title="Sin movimientos" description="No hubo entradas/salidas/ajustes en ese rango con esos filtros." />
      )}

      {report && report.items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Entradas: {formatQty(report.totalsByType.entrada)}</Badge>
            <Badge variant="danger">Salidas: {formatQty(report.totalsByType.salida)}</Badge>
            <Badge variant="neutral">Ajustes: {formatQty(report.totalsByType.ajuste)}</Badge>
            {report.truncated && (
              <span className="text-xs text-warning">
                Se muestran los primeros 5000 movimientos — acotá el rango de fechas para ver todo.
              </span>
            )}
          </div>

          <div className="flex items-center justify-end">
            <CsvDownloadButton
              filename="movimientos.csv"
              rows={report.items}
              columns={[
                { header: "Fecha", value: (r) => r.createdAt },
                { header: "SKU", value: (r) => r.sku },
                { header: "Producto", value: (r) => r.productName },
                { header: "Tipo", value: (r) => TYPE_LABEL[r.type] },
                { header: "Cantidad", value: (r) => r.quantity },
                { header: "Motivo", value: (r) => r.reason ?? "" },
                { header: "Referencia", value: (r) => r.reference ?? "" },
                { header: "Usuario", value: (r) => r.createdByName },
              ]}
            />
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Producto</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Cantidad</Th>
                <Th>Motivo / Referencia</Th>
                <Th>Usuario</Th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((m) => (
                <tr key={m.id} className="hover:bg-bg-sunken">
                  <Td className="text-text-tertiary">{new Date(m.createdAt).toLocaleString("es-AR")}</Td>
                  <Td className="font-medium">{m.productName}</Td>
                  <Td>
                    <Badge variant={m.type === "entrada" ? "success" : m.type === "salida" ? "danger" : "neutral"}>
                      {TYPE_LABEL[m.type]}
                    </Badge>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{formatQty(m.quantity)}</Td>
                  <Td className="text-text-secondary">{m.reason ?? m.reference ?? "—"}</Td>
                  <Td className="text-text-secondary">{m.createdByName}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
}
