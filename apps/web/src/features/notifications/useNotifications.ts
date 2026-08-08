import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@stock-c/shared-types";
import { getUnreadCount, listNotifications, markNotificationRead } from "./api";

const POLL_INTERVAL_MS = 45_000;

export interface NotificationsState {
  unreadCount: number;
  items: Notification[];
  loadingItems: boolean;
  loadItems: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

/** Sin evento de servidor que avise "hay algo nuevo" (Fase 12 elige
 * polling in-app, no tiempo real — ver docs/12, sección 2), así que el
 * contador se refresca por intervalo + al volver el foco a la pestaña,
 * igual que ya reacciona el resto de la app a la reconexión (Fase 10). */
export function useNotifications(accessToken: string | null): NotificationsState {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!accessToken) return;
    const res = await getUnreadCount(accessToken);
    setUnreadCount(res.count);
  }, [accessToken]);

  const loadItems = useCallback(async () => {
    if (!accessToken) return;
    setLoadingItems(true);
    try {
      const res = await listNotifications(accessToken);
      setItems(res.items);
    } finally {
      setLoadingItems(false);
    }
  }, [accessToken]);

  const markRead = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await markNotificationRead(accessToken, id);
    },
    [accessToken],
  );

  useEffect(() => {
    void refreshUnreadCount();
    const interval = setInterval(() => void refreshUnreadCount(), POLL_INTERVAL_MS);
    const onFocus = () => void refreshUnreadCount();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshUnreadCount]);

  return { unreadCount, items, loadingItems, loadItems, markRead };
}
