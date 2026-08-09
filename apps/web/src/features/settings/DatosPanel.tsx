import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@stock-c/ui";
import { useAuth } from "../auth/AuthContext";
import { listProducts } from "../products/api";
import { listCategories, listBrands, listUnits } from "../catalogs/api";
import { getStockLevels } from "../inventory/api";
import { downloadCsv, toCsv } from "../../lib/csv";

// Sin deep-link a la pestaña puntual: Reportes (Fase 11) usa `Tabs` sin
// estado en la URL — el link lleva a /reportes y el usuario elige la
// pestaña ahí mismo (agregarlo sería ampliar el alcance de esta fase).
const REPORT_LINKS = [
  { label: "Valorización de inventario", description: "Stock × costo por producto/categoría/marca." },
  { label: "Movimientos por rango de fechas", description: "Entradas/salidas/ajustes filtrables." },
  { label: "Resumen por categoría/marca", description: "Activos/inactivos y distribución de stock." },
  { label: "Stock bajo", description: "Productos por debajo de su mínimo." },
];

export function DatosPanel() {
  const { accessToken } = useAuth();
  const [exporting, setExporting] = useState(false);

  async function handleExportCatalog() {
    if (!accessToken) return;
    setExporting(true);
    try {
      const [categories, brands, units] = await Promise.all([
        listCategories(accessToken),
        listBrands(accessToken),
        listUnits(accessToken),
      ]);
      const categoryNames = new Map(categories.items.map((c) => [c.id, c.name]));
      const brandNames = new Map(brands.items.map((b) => [b.id, b.name]));
      const unitNames = new Map(units.items.map((u) => [u.id, u.name]));

      const products = [];
      let cursor: string | null | undefined;
      do {
        const res = await listProducts(accessToken, { cursor, limit: 200 });
        products.push(...res.items);
        cursor = res.nextCursor;
      } while (cursor);

      const stockLevels = await getStockLevels(accessToken, products.map((p) => p.id));
      const quantityByProduct = new Map(stockLevels.items.map((s) => [s.productId, s.quantity]));

      const csv = toCsv(products, [
        { header: "SKU", value: (p) => p.sku },
        { header: "Nombre", value: (p) => p.name },
        { header: "Categoría", value: (p) => (p.categoryId ? (categoryNames.get(p.categoryId) ?? "") : "") },
        { header: "Marca", value: (p) => (p.brandId ? (brandNames.get(p.brandId) ?? "") : "") },
        { header: "Unidad", value: (p) => (p.unitId ? (unitNames.get(p.unitId) ?? "") : "") },
        { header: "Precio", value: (p) => p.price },
        { header: "Costo", value: (p) => p.cost ?? "" },
        { header: "Stock mínimo", value: (p) => p.minStock ?? "" },
        { header: "Stock actual", value: (p) => quantityByProduct.get(p.id) ?? "0" },
        { header: "Estado", value: (p) => (p.active ? "Activo" : "Inactivo") },
      ]);
      downloadCsv("catalogo-productos.csv", csv);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text">Reportes con exportación a CSV</h3>
        <div className="flex flex-col gap-2">
          {REPORT_LINKS.map((r) => (
            <Link
              key={r.label}
              to="/reportes"
              className="flex flex-col rounded-md border border-border p-3 text-[13px] hover:border-accent"
            >
              <span className="font-medium text-text">{r.label}</span>
              <span className="text-text-tertiary">{r.description}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-text">Catálogo completo</h3>
        <p className="text-[13px] text-text-secondary">
          Todos los productos (sin agrupar ni acotar por fecha) con categoría, marca, unidad y stock actual.
        </p>
        <div>
          <Button variant="secondary" onClick={() => void handleExportCatalog()} disabled={exporting}>
            {exporting ? "Exportando…" : "Exportar catálogo completo (CSV)"}
          </Button>
        </div>
      </div>
    </div>
  );
}
