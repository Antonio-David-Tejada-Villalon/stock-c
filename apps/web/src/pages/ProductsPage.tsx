import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Badge, Button, EmptyState, Input, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type Brand, type Category, type Product, type Unit } from "@stock-c/shared-types";
import { useAuth } from "../features/auth/AuthContext";
import { listBrands, listCategories, listUnits } from "../features/catalogs/api";
import { KardexDrawer } from "../features/inventory/KardexDrawer";
import { deactivateProduct } from "../features/products/api";
import { ProductFormDrawer } from "../features/products/ProductFormDrawer";
import { db } from "../offline/db";
import { useOfflineSync } from "../offline/useOfflineSync";

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;
}

function formatQty(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 4 }) : value;
}

export function ProductsPage() {
  const { accessToken, user } = useAuth();
  const { online, sync } = useOfflineSync(accessToken);
  const permissions = user?.role.permissions ?? [];
  const canCreate = permissions.includes(PERMISSIONS.PRODUCT_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.PRODUCT_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.PRODUCT_DELETE);

  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [kardexProduct, setKardexProduct] = useState<Product | undefined>(undefined);
  const [kardexOpen, setKardexOpen] = useState(false);

  useEffect(() => {
    if (!accessToken || !online) return;
    void listCategories(accessToken).then((res) => setCategories(res.items));
    void listBrands(accessToken).then((res) => setBrands(res.items));
    void listUnits(accessToken).then((res) => setUnits(res.items));
  }, [accessToken, online]);

  // Catálogo cacheado localmente (Fase 10) — ya no se pagina por cursor
  // contra el servidor: el caché completo ya está en memoria vía Dexie,
  // así que "paginar" un array que ya está local no cumple ningún
  // propósito (la paginación por cursor existía para evitar skip/limit
  // en una consulta remota, no aplica acá). Se filtra y ordena en el
  // cliente.
  const allProducts = useLiveQuery(() => db.products.orderBy("name").toArray(), []) ?? [];
  const stockLevels = useLiveQuery(() => db.stockLevels.toArray(), []) ?? [];
  const stockByProduct = useMemo(
    () => Object.fromEntries(stockLevels.map((s) => [s.productId, s.quantity])),
    [stockLevels],
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    );
  }, [allProducts, search]);

  function openCreate() {
    setEditing(undefined);
    setDrawerOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setDrawerOpen(true);
  }

  function openKardex(product: Product) {
    setKardexProduct(product);
    setKardexOpen(true);
  }

  function handleSaved() {
    void sync();
  }

  async function handleDeactivate(product: Product) {
    if (!accessToken) return;
    if (!confirm(`¿Desactivar "${product.name}"? Podés reactivarlo después editándolo.`)) return;
    await deactivateProduct(accessToken, product.id);
    void sync();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
        {canCreate && (
          <Button
            onClick={openCreate}
            disabled={!online}
            title={online ? undefined : "Necesitás conexión para crear productos"}
          >
            Nuevo producto
          </Button>
        )}
      </div>

      <Input
        placeholder="Buscar por nombre, SKU o código de barras…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {items.length === 0 ? (
        <EmptyState
          title={search ? "Sin resultados" : "Todavía no hay productos"}
          description={
            search
              ? "Probá con otra búsqueda."
              : online
                ? "Creá el primero con el botón de arriba."
                : "Conectate para sincronizar el catálogo por primera vez."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Producto</Th>
              <Th>SKU</Th>
              <Th className="text-right">Precio</Th>
              <Th className="text-right">Costo</Th>
              <Th className="text-right">Stock</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((product) => (
              <tr key={product.id} className="hover:bg-bg-sunken">
                <Td className="font-medium">{product.name}</Td>
                <Td className="font-mono text-text-tertiary">{product.sku}</Td>
                <Td className="text-right font-mono tabular-nums">${formatMoney(product.price)}</Td>
                <Td className="text-right font-mono tabular-nums">
                  {product.cost ? `$${formatMoney(product.cost)}` : "—"}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {(() => {
                    const qty = stockByProduct[product.id];
                    return qty !== undefined ? formatQty(qty) : "…";
                  })()}
                </Td>
                <Td>
                  <Badge variant={product.active ? "success" : "neutral"}>
                    {product.active ? "Activo" : "Inactivo"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3 text-xs">
                    <button
                      type="button"
                      className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-text-tertiary disabled:no-underline"
                      onClick={() => openKardex(product)}
                      disabled={!online}
                      title={online ? undefined : "Necesitás conexión para ver el kardex"}
                    >
                      Ver kardex
                    </button>
                    {canUpdate && (
                      <button
                        type="button"
                        className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-text-tertiary disabled:no-underline"
                        onClick={() => openEdit(product)}
                        disabled={!online}
                        title={online ? undefined : "Necesitás conexión para editar productos"}
                      >
                        Editar
                      </button>
                    )}
                    {canDelete && product.active && (
                      <button
                        type="button"
                        className="text-danger hover:underline disabled:cursor-not-allowed disabled:text-text-tertiary disabled:no-underline"
                        onClick={() => void handleDeactivate(product)}
                        disabled={!online}
                        title={online ? undefined : "Necesitás conexión para desactivar productos"}
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ProductFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        product={editing}
        categories={categories}
        brands={brands}
        units={units}
        onSaved={handleSaved}
      />

      <KardexDrawer open={kardexOpen} onOpenChange={setKardexOpen} product={kardexProduct} />
    </div>
  );
}
