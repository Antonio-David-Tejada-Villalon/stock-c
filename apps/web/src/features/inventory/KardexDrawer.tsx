import { useEffect, useState } from "react";
import { Badge, Button, Drawer, Table, Td, Th } from "@stock-c/ui";
import type { Product, StockMovement } from "@stock-c/shared-types";
import { useAuth } from "../auth/AuthContext";
import { getStockLevels, listMovements } from "./api";

function formatQty(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 4 }) : value;
}

const TYPE_LABEL: Record<StockMovement["type"], string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

export interface KardexDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
}

export function KardexDrawer({ open, onOpenChange, product }: KardexDrawerProps) {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<StockMovement[]>([]);
  const [stock, setStock] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !product || !accessToken) return;
    setItems([]);
    setStock(null);
    setNextCursor(null);
    setLoading(true);
    void Promise.all([
      listMovements(accessToken, { productId: product.id, limit: 20 }),
      getStockLevels(accessToken, [product.id]),
    ]).then(([movements, levels]) => {
      setItems(movements.items);
      setNextCursor(movements.nextCursor);
      setStock(levels.items[0]?.quantity ?? "0");
      setLoading(false);
    });
  }, [open, product, accessToken]);

  async function handleLoadMore() {
    if (!accessToken || !product || !nextCursor) return;
    setLoading(true);
    try {
      const res = await listMovements(accessToken, { productId: product.id, cursor: nextCursor, limit: 20 });
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={product ? `Kardex — ${product.name}` : "Kardex"}>
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-border bg-bg-sunken px-3 py-2 text-sm">
          Stock actual: <span className="font-semibold">{stock !== null ? formatQty(stock) : "…"}</span>
        </div>

        {items.length === 0 && !loading ? (
          <p className="text-sm text-text-tertiary">Todavía no hay movimientos para este producto.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Cantidad</Th>
                <Th>Motivo</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <Td className="text-text-tertiary">{new Date(m.createdAt).toLocaleString("es-AR")}</Td>
                  <Td>
                    <Badge variant={m.type === "salida" ? "warning" : "success"}>{TYPE_LABEL[m.type]}</Badge>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{formatQty(m.quantity)}</Td>
                  <Td className="text-text-secondary">{m.reason ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {nextCursor && (
          <Button variant="secondary" onClick={() => void handleLoadMore()} disabled={loading}>
            {loading ? "Cargando…" : "Cargar más"}
          </Button>
        )}
      </div>
    </Drawer>
  );
}
