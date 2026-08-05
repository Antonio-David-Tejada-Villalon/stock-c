import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Pagination, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type Product, type StockMovement } from "@stock-c/shared-types";
import { useAuth } from "../features/auth/AuthContext";
import { listProducts } from "../features/products/api";
import { listMovements } from "../features/inventory/api";
import { MovementFormDrawer } from "../features/inventory/MovementFormDrawer";

const PAGE_SIZE = 20;

function formatQty(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 4 }) : value;
}

const TYPE_LABEL: Record<StockMovement["type"], string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

export function MovementsPage() {
  const { accessToken, user } = useAuth();
  const canCreate = (user?.role.permissions ?? []).includes(PERMISSIONS.INVENTORY_MOVEMENT_CREATE);

  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const productById = new Map(products.map((p) => [p.id, p]));

  useEffect(() => {
    if (!accessToken) return;
    void listProducts(accessToken, { limit: 100 }).then((res) => setProducts(res.items));
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await listMovements(accessToken, { cursor, limit: PAGE_SIZE });
      setItems(res.items);
      setNextCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [accessToken, cursor]);

  useEffect(() => {
    void load();
  }, [load]);

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

  function handleSaved() {
    setCursorStack([]);
    setCursor(null);
    void load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos de stock</h1>
        {canCreate && <Button onClick={() => setDrawerOpen(true)}>Nuevo movimiento</Button>}
      </div>

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Todavía no hay movimientos"
          description="Registrá el primero con el botón de arriba."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Producto</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Cantidad</Th>
                <Th>Motivo</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-bg-sunken">
                  <Td className="text-text-tertiary">{new Date(m.createdAt).toLocaleString("es-AR")}</Td>
                  <Td className="font-medium">{productById.get(m.productId)?.name ?? m.productId}</Td>
                  <Td>
                    <Badge variant={m.type === "salida" ? "warning" : "success"}>{TYPE_LABEL[m.type]}</Badge>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{formatQty(m.quantity)}</Td>
                  <Td className="text-text-secondary">{m.reason ?? "—"}</Td>
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

      <MovementFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        products={products}
        onSaved={handleSaved}
      />
    </div>
  );
}
