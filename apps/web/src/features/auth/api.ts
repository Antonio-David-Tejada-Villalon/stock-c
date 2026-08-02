import type { AuthUser } from "@stock-c/shared-types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Header custom exigido por el backend en /auth/refresh y /auth/logout —
// mitigación CSRF, ver docs/05-autenticacion.md, sección 3.
const CSRF_HEADER = { "X-Requested-With": "stock-c" } as const;

export class ApiAuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function parseErrorAndThrow(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  throw new ApiAuthError(res.status, body.error ?? "unknown_error", body.message ?? "Error inesperado");
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return parseErrorAndThrow(res);
  return res.json();
}

export async function refreshRequest(): Promise<{ accessToken: string }> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: CSRF_HEADER,
  });
  if (!res.ok) return parseErrorAndThrow(res);
  return res.json();
}

export async function logoutRequest(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: CSRF_HEADER,
  });
}

export async function meRequest(accessToken: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return parseErrorAndThrow(res);
  return res.json();
}
