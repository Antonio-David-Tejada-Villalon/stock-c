import type {
  CreateStockMovementResponse,
  StockLevelListResponse,
  StockMovementListResponse,
  StockMovementType,
} from "@stock-c/shared-types";
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

export interface CreateMovementInput {
  productId: string;
  type: StockMovementType;
  /** Positivo en entrada/salida; positivo o negativo en ajuste. */
  quantity: string;
  reason?: string;
  reference?: string;
  clientMutationId: string;
  /** Presente solo cuando lo manda el motor de sync offline (Fase 10) — ver
   * docs/12-notificaciones.md, sección 2. */
  source?: "sync";
}

export function createMovement(accessToken: string, input: CreateMovementInput) {
  return request<CreateStockMovementResponse>("/stock-movements", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface ListMovementsParams {
  productId?: string;
  cursor?: string | null;
  limit?: number;
}

export function listMovements(accessToken: string, params: ListMovementsParams = {}) {
  const search = new URLSearchParams();
  if (params.productId) search.set("productId", params.productId);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return request<StockMovementListResponse>(`/stock-movements${qs ? `?${qs}` : ""}`, accessToken);
}

export function getStockLevels(accessToken: string, productIds: string[]) {
  if (productIds.length === 0) return Promise.resolve<StockLevelListResponse>({ items: [] });
  const search = new URLSearchParams({ productIds: productIds.join(",") });
  return request<StockLevelListResponse>(`/stock-levels?${search.toString()}`, accessToken);
}
