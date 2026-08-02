import type { DashboardSummary } from "@stock-c/shared-types";
import { ApiAuthError } from "../auth/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function fetchDashboardSummary(accessToken: string): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiAuthError(res.status, body.error ?? "unknown_error", body.message ?? "Error inesperado");
  }
  return res.json();
}
