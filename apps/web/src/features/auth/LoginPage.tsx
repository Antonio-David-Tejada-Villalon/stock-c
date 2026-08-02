import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@stock-c/ui";
import { useAuth } from "./AuthContext";
import { ApiAuthError } from "./api";

export function LoginPage() {
  const { login, status } = useAuth();
  const location = useLocation() as { state?: { from?: { pathname: string } } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated") {
    const redirectTo = location.state?.from?.pathname ?? "/";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiAuthError && err.status === 429) {
        setError("Demasiados intentos. Esperá unos minutos antes de volver a intentar.");
      } else if (err instanceof ApiAuthError && err.code === "account_disabled") {
        setError("Esta cuenta está deshabilitada. Contactá a un administrador.");
      } else {
        setError("Correo o contraseña incorrectos.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg-sunken font-sans text-text">
      <form
        onSubmit={handleSubmit}
        className="w-80 rounded-lg border border-border bg-bg-raised p-8 shadow-lg"
      >
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-contrast">
            S
          </span>
          <strong className="text-[15px]">STOCK-C</strong>
        </div>
        <h1 className="mb-1 text-center text-base font-semibold text-text">Iniciar sesión</h1>
        <p className="mb-6 text-center text-xs text-text-tertiary">Accedé a tu empresa</p>

        <label className="mb-1.5 block text-xs font-semibold text-text-secondary" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border-strong bg-bg-raised px-2.5 py-2 text-[13px] text-text"
        />

        <label
          className="mb-1.5 mt-4 block text-xs font-semibold text-text-secondary"
          htmlFor="password"
        >
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-border-strong bg-bg-raised px-2.5 py-2 text-[13px] text-text"
        />

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-danger-wash px-2.5 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="mt-5 w-full justify-center">
          {submitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
