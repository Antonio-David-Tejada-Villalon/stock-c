import type { Branch, BranchListResponse, Company, TeamUser, TeamUserListResponse } from "@stock-c/shared-types";
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

// --- Empresa ---

export function getCompany(accessToken: string) {
  return request<Company>("/company", accessToken);
}

export interface UpdateCompanyInput {
  version: number;
  name?: string;
  taxId?: string | null;
  settings?: {
    timezone?: string;
    currency?: string;
    accentColor?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
  };
}

export function updateCompany(accessToken: string, input: UpdateCompanyInput) {
  return request<Company>("/company", accessToken, { method: "PATCH", body: JSON.stringify(input) });
}

// --- Sucursales ---

export function listBranches(accessToken: string) {
  return request<BranchListResponse>("/branches", accessToken);
}

export function createBranch(accessToken: string, input: { name: string; code: string; address?: string }) {
  return request<Branch>("/branches", accessToken, { method: "POST", body: JSON.stringify(input) });
}

export function updateBranch(
  accessToken: string,
  id: string,
  input: { version: number; name?: string; code?: string; address?: string | null },
) {
  return request<Branch>(`/branches/${id}`, accessToken, { method: "PATCH", body: JSON.stringify(input) });
}

export function activateBranch(accessToken: string, id: string) {
  return request<void>(`/branches/${id}/activate`, accessToken, { method: "POST" });
}

export function deleteBranch(accessToken: string, id: string) {
  return request<void>(`/branches/${id}`, accessToken, { method: "DELETE" });
}

// --- Usuarios (equipo) ---

export function listTeamUsers(accessToken: string) {
  return request<TeamUserListResponse>("/users", accessToken);
}

export function createTeamUser(
  accessToken: string,
  input: { name: string; email: string; password: string; roleName: string },
) {
  return request<TeamUser>("/users", accessToken, { method: "POST", body: JSON.stringify(input) });
}

export function updateTeamUser(
  accessToken: string,
  id: string,
  input: { version: number; name?: string; email?: string; roleName?: string; active?: boolean; password?: string },
) {
  return request<TeamUser>(`/users/${id}`, accessToken, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTeamUser(accessToken: string, id: string) {
  return request<void>(`/users/${id}`, accessToken, { method: "DELETE" });
}
