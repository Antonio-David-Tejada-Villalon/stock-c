import { Badge } from "@stock-c/ui";
import { useOfflineSync } from "./useOfflineSync";

export function SyncStatusBadge({ accessToken }: { accessToken: string | null }) {
  const { online, syncing, pendingCount, failedCount, sync } = useOfflineSync(accessToken);

  if (!online) {
    return (
      <Badge variant="neutral">
        Sin conexión{pendingCount > 0 ? ` · ${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}` : ""}
      </Badge>
    );
  }

  if (syncing || pendingCount > 0) {
    return <Badge variant="warning">Sincronizando… ({pendingCount})</Badge>;
  }

  if (failedCount > 0) {
    return (
      <button type="button" onClick={() => void sync()} title="Reintentar sincronización">
        <Badge variant="danger">{failedCount} con error</Badge>
      </button>
    );
  }

  return (
    <button type="button" onClick={() => void sync()} title="Sincronizar ahora">
      <Badge variant="success">En línea</Badge>
    </button>
  );
}
