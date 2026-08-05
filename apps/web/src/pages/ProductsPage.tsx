import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Input, Pagination, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type Brand, type Category, type Product, type Unit } from "@stock-c/shared-types";
import { useAuth } from "../features/auth/AuthContext";
import { listBrands, listCategories, listUnits } from "../features/catalogs/api";
import { getStockLevels } from "../features/inventory/api";
import { KardexDrawer } from "../features/inventory/KardexDrawer";
import { deactivateProduct, listProducts } from "../features/products/api";
import { ProductFormDrawer } from "../features/products/ProductFormDrawer";

const PAGE_SIZE = 20;

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
  const permissions = user?.role.permissions ?? [];
  const canCreate = permissions.includes(PERMISSIONS.PRODUCT_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.PRODUCT_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.PRODUCT_DELETE);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<string, string>>({});
  const [kardexProduct, setKardexProduct] = useState<Product | undefined>(undefined);
  const [kardexOpen, setKardexOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    void listCategories(accessToken).then((res) => setCategories(res.items));
    void listBrands(accessToken).then((res) => setBrands(res.items));
    void listUnits(accessToken).then((res) => setUnits(res.items));
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await listProducts(accessToken, {
        cursor,
        limit: PAGE_SIZE,
        q: search || undefined,
      });
      setItems(res.items);
      setNextCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [accessToken, cursor, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken || items.length === 0) return;
    void getStockLevels(
      accessToken,
      items.map((p) => p.id),
    ).then((res) => {
      setStockByProduct(Object.fromEntries(res.items.map((s) => [s.productId, s.quantity])));
    });
  }, [accessToken, items]);

  useEffect(() => {
    const id = setTimeout(() => {
      setCursorStack([]);
      setCursor(null);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  function handleNext() {
    if (!nextCursor) return;
    setCursorStack((stack) => [...stack, cursor ?? ""]);
    setCursor(nextCursor);
  }

  function handlePrev() {
    setCursorStack((stack) => {
      const copy = [...stack];
      const prev = copy.pop() ?? null;
      setCursor(prev || null);
      return copy;
    });
  }

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
    void load();
  }

  async function handleDeactivate(product: Product) {
    if (!accessToken) return;
    if (!confirm(`¿Desactivar "${product.name}"? Podés reactivarlo después editándolo.`)) return;
    await deactivateProduct(accessToken, product.id);
    void load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
        {canCreate && <Button onClick={openCreate}>Nuevo producto</Button>}
      </div>

      <Input
        placeholder="Buscar por nombre, SKU o código de barras…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {!loading && items.length === 0 ? (
        <EmptyState
          title={search ? "Sin resultados" : "Todavía no hay productos"}
          description={search ? "Probá con otra búsqueda." : "Creá el primero con el botón de arriba."}
        />
      ) : (
        <>
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
                        className="text-accent hover:underline"
                        onClick={() => openKardex(product)}
                      >
                        Ver kardex
                      </button>
                      {canUpdate && (
                        <button
                          type="button"
                          className="text-accent hover:underline"
                          onClick={() => openEdit(product)}
                        >
                          Editar
                        </button>
                      )}
                      {canDelete && product.active && (
                        <button
                          type="button"
                          className="text-danger hover:underline"
                          onClick={() => void handleDeactivate(product)}
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

          <Pagination
            onPrev={handlePrev}
            onNext={handleNext}
            hasPrev={cursorStack.length > 0}
            hasNext={!!nextCursor}
          />
        </>
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
