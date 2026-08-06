import type {
  Brand,
  BrandListResponse,
  Category,
  CategoryListResponse,
  Unit,
  UnitListResponse,
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

// --- Categorías ---

export interface CategoryInput {
  name: string;
  parentId?: string;
  code?: string;
  icon?: string;
  color?: string;
  imageUrl?: string;
}

export function listCategories(accessToken: string) {
  return request<CategoryListResponse>("/categories", accessToken);
}

export function createCategory(accessToken: string, input: CategoryInput) {
  return request<Category>("/categories", accessToken, { method: "POST", body: JSON.stringify(input) });
}

export function updateCategory(
  accessToken: string,
  id: string,
  input: Partial<{
    name: string;
    parentId: string | null;
    code: string | null;
    icon: string | null;
    color: string | null;
    imageUrl: string | null;
  }> & { version: number; active?: boolean },
) {
  return request<Category>(`/categories/${id}`, accessToken, { method: "PATCH", body: JSON.stringify(input) });
}

export function deactivateCategory(accessToken: string, id: string) {
  return request<void>(`/categories/${id}`, accessToken, { method: "DELETE" });
}

export function moveCategory(accessToken: string, id: string, direction: "up" | "down") {
  return request<void>(`/categories/${id}/move`, accessToken, {
    method: "POST",
    body: JSON.stringify({ direction }),
  });
}

// --- Marcas ---

export interface BrandInput {
  name: string;
}

export function listBrands(accessToken: string) {
  return request<BrandListResponse>("/brands", accessToken);
}

export function createBrand(accessToken: string, input: BrandInput) {
  return request<Brand>("/brands", accessToken, { method: "POST", body: JSON.stringify(input) });
}

export function updateBrand(
  accessToken: string,
  id: string,
  input: Partial<BrandInput> & { version: number; active?: boolean },
) {
  return request<Brand>(`/brands/${id}`, accessToken, { method: "PATCH", body: JSON.stringify(input) });
}

export function deactivateBrand(accessToken: string, id: string) {
  return request<void>(`/brands/${id}`, accessToken, { method: "DELETE" });
}

// --- Unidades ---

export interface UnitInput {
  name: string;
  abbreviation?: string;
}

export function listUnits(accessToken: string) {
  return request<UnitListResponse>("/units", accessToken);
}

export function createUnit(accessToken: string, input: UnitInput) {
  return request<Unit>("/units", accessToken, { method: "POST", body: JSON.stringify(input) });
}

export function updateUnit(
  accessToken: string,
  id: string,
  input: Partial<UnitInput> & { version: number; active?: boolean },
) {
  return request<Unit>(`/units/${id}`, accessToken, { method: "PATCH", body: JSON.stringify(input) });
}

export function deactivateUnit(accessToken: string, id: string) {
  return request<void>(`/units/${id}`, accessToken, { method: "DELETE" });
}
