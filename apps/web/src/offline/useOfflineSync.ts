import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { runSync } from "./syncEngine";
import { useOnlineStatus } from "./connectivity";

export interface OfflineSyncState {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
  sync: () => Promise<void>;
}

/** Dispara la sync al montar, al reconectar, y expone un disparador manual. */
export function useOfflineSync(accessToken: string | null): OfflineSyncState {
  const online = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);

  const pendingCount =
    useLiveQuery(() => db.outboxMovements.where("status").anyOf(["pending", "syncing"]).count(), []) ?? 0;
  const failedCount = useLiveQuery(() => db.outboxMovements.where("status").equals("failed").count(), []) ?? 0;

  const sync = useCallback(async () => {
    if (!accessToken || !navigator.onLine) return;
    setSyncing(true);
    try {
      await runSync(accessToken);
    } finally {
      setSyncing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) void sync();
  }, [accessToken, sync]);

  useEffect(() => {
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [sync]);

  return { online, syncing, pendingCount, failedCount, sync };
}
