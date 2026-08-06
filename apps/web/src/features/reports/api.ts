import type {
  CatalogSummaryReport,
  InventoryValuationReport,
  LowStockReport,
  MovementsReport,
  StockMovementType,
} from "@stock-c/shared-types";
import { ApiAuthError } from "../auth/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiAuthError(res.status, body.error ?? "unknown_error", body.message ?? "Error inesperado");
  }
  return res.json();
}

export function getInventoryValuation(accessToken: string) {
  return request<InventoryValuationReport>("/reports/inventory-valuation", accessToken);
}

export interface MovementsReportParams {
  dateFrom: string;
  dateTo: string;
  type?: StockMovementType;
  categoryId?: string;
}

export function getMovementsReport(accessToken: string, params: MovementsReportParams) {
  const search = new URLSearchParams({ dateFrom: params.dateFrom, dateTo: params.dateTo });
  if (params.type) search.set("type", params.type);
  if (params.categoryId) search.set("categoryId", params.categoryId);
  return request<MovementsReport>(`/reports/movements?${search.toString()}`, accessToken);
}

export function getCatalogSummary(accessToken: string) {
  return request<CatalogSummaryReport>("/reports/catalog-summary", accessToken);
}

export function getLowStock(accessToken: string) {
  return request<LowStockReport>("/reports/low-stock", accessToken);
}
