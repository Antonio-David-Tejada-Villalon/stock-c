import type { Product, ProductListResponse } from "@stock-c/shared-types";
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

export interface ListProductsParams {
  cursor?: string | null;
  limit?: number;
  q?: string;
  active?: boolean;
}

export function listProducts(accessToken: string, params: ListProductsParams = {}) {
  const search = new URLSearchParams();
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.q) search.set("q", params.q);
  if (params.active !== undefined) search.set("active", String(params.active));
  const qs = search.toString();
  return request<ProductListResponse>(`/products${qs ? `?${qs}` : ""}`, accessToken);
}

export interface ProductInput {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  unitId?: string;
  barcode?: string;
  price: string;
  cost?: string;
}

export function createProduct(accessToken: string, input: ProductInput) {
  return request<Product>("/products", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProduct(
  accessToken: string,
  id: string,
  input: Partial<Omit<ProductInput, "categoryId" | "brandId" | "unitId">> & {
    version: number;
    active?: boolean;
    categoryId?: string | null;
    brandId?: string | null;
    unitId?: string | null;
  },
) {
  return request<Product>(`/products/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deactivateProduct(accessToken: string, id: string) {
  return request<void>(`/products/${id}`, accessToken, { method: "DELETE" });
}
