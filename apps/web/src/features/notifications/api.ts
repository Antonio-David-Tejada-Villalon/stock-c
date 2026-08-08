import type { NotificationListResponse, UnreadNotificationCount } from "@stock-c/shared-types";
import { ApiAuthError } from "../auth/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiAuthError(res.status, body.error ?? "unknown_error", body.message ?? "Error inesperado");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listNotifications(accessToken: string, cursor?: string | null) {
  const search = new URLSearchParams();
  if (cursor) search.set("cursor", cursor);
  const qs = search.toString();
  return request<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ""}`, accessToken);
}

export function getUnreadCount(accessToken: string) {
  return request<UnreadNotificationCount>("/notifications/unread-count", accessToken);
}

export function markNotificationRead(accessToken: string, id: string) {
  return request<void>(`/notifications/${id}/read`, accessToken, { method: "POST" });
}
