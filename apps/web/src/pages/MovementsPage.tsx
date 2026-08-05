import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Badge, Button, EmptyState, Pagination, Table, Td, Th } from "@stock-c/ui";
import { PERMISSIONS, type StockMovement } from "@stock-c/shared-types";
import { useAuth } from "../features/auth/AuthContext";
import { listMovements } from "../features/inventory/api";
import { MovementFormDrawer } from "../features/inventory/MovementFormDrawer";
import { db } from "../offline/db";
import { discardFailedMovement, retryFailedMovement } from "../offline/syncEngine";
import { useOfflineSync } from "../offline/useOfflineSync";

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
  const { online, sync } = useOfflineSync(accessToken);
  const canCreate = (user?.role.permissions ?? []).includes(PERMISSIONS.INVENTORY_MOVEMENT_CREATE);

  // Caché local de productos (Fase 10) — así el selector de "Nuevo
  // movimiento" también funciona sin conexión.
  const products = useLiveQuery(() => db.products.filter((p) => p.active).sortBy("name"), []) ?? [];
  const productById = new Map(products.map((p) => [p.id, p]));

  const outbox = useLiveQuery(() => db.outboxMovements.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const pendingOutbox = outbox.filter((m) => m.status === "pending" || m.status === "syncing");
  const failedOutbox = outbox.filter((m) => m.status === "failed");

  const [items, setItems] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !online) return;
    setLoading(true);
    try {
      const res = await listMovements(accessToken, { cursor, limit: PAGE_SIZE });
      setItems(res.items);
      setNextCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [accessToken, online, cursor]);

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

  async function handleRetry(localId?: number) {
    if (localId === undefined) return;
    await retryFailedMovement(localId);
    void sync();
  }

  async function handleDiscard(localId?: number) {
    if (localId === undefined) return;
    if (!confirm("¿Descartar este movimiento? No se va a registrar.")) return;
    await discardFailedMovement(localId);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos de stock</h1>
        {canCreate && <Button onClick={() => setDrawerOpen(true)}>Nuevo movimiento</Button>}
      </div>

      {failedOutbox.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold text-danger">Con error</h2>
          <Table>
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Cantidad</Th>
                <Th>Motivo del rechazo</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {failedOutbox.map((m) => (
                <tr key={m.localId}>
                  <Td className="font-medium">{productById.get(m.productId)?.name ?? m.productId}</Td>
                  <Td>
                    <Badge variant={m.type === "salida" ? "warning" : "success"}>{TYPE_LABEL[m.type]}</Badge>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{formatQty(m.quantity)}</Td>
                  <Td className="text-danger">{m.errorMessage}</Td>
                  <Td>
                    <div className="flex justify-end gap-3 text-xs">
                      <button type="button" className="text-accent hover:underline" onClick={() => void handleRetry(m.localId)}>
                        Reintentar
                      </button>
                      <button type="button" className="text-danger hover:underline" onClick={() => void handleDiscard(m.localId)}>
                        Descartar
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {pendingOutbox.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold">Pendientes de sincronizar</h2>
          <Table>
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Cantidad</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {pendingOutbox.map((m) => (
                <tr key={m.localId}>
                  <Td className="font-medium">{productById.get(m.productId)?.name ?? m.productId}</Td>
                  <Td>
                    <Badge variant={m.type === "salida" ? "warning" : "success"}>{TYPE_LABEL[m.type]}</Badge>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{formatQty(m.quantity)}</Td>
                  <Td className="text-text-tertiary">{m.status === "syncing" ? "Sincronizando…" : "En espera"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">Recientes</h2>
        {!online ? (
          <EmptyState
            title="Necesitás conexión"
            description="El historial de movimientos sincronizados se consulta al servidor — probá de nuevo cuando estés en línea."
          />
        ) : !loading && items.length === 0 ? (
          <EmptyState title="Todavía no hay movimientos" description="Registrá el primero con el botón de arriba." />
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

            <Pagination onPrev={handlePrev} onNext={handleNext} hasPrev={cursorStack.length > 0} hasNext={!!nextCursor} />
          </>
        )}
      </div>

      <MovementFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} products={products} onSaved={handleSaved} />
    </div>
  );
}
