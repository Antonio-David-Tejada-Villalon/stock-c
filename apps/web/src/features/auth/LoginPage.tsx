import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { ApiAuthError } from "./api";

const tokens = {
  accent: "#4453F0",
  accentHover: "#3641D6",
  border: "#E3E3EC",
  borderStrong: "#C7C7D6",
  text: "#14161A",
  textSecondary: "#53566B",
  textTertiary: "#8A8DA1",
  danger: "#D6423C",
  dangerWash: "#FCECEB",
  bgSunken: "#F1F1F6",
};

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
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        background: tokens.bgSunken,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 320,
          background: "#fff",
          border: `1px solid ${tokens.border}`,
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 8px 24px rgba(20,22,40,0.10)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: tokens.accent,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            S
          </span>
          <strong style={{ fontSize: 15 }}>STOCK-C</strong>
        </div>
        <h1 style={{ fontSize: 16, textAlign: "center", margin: "0 0 4px" }}>Iniciar sesión</h1>
        <p style={{ fontSize: 12, color: tokens.textTertiary, textAlign: "center", margin: "0 0 24px" }}>
          Accedé a tu empresa
        </p>

        <label style={fieldLabelStyle} htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label style={{ ...fieldLabelStyle, marginTop: 16 }} htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <p
            role="alert"
            style={{
              marginTop: 12,
              fontSize: 12,
              color: tokens.danger,
              background: tokens.dangerWash,
              padding: "8px 10px",
              borderRadius: 8,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: submitting ? tokens.borderStrong : tokens.accent,
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

const fieldLabelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: tokens.textSecondary,
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  fontSize: 13,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${tokens.borderStrong}`,
};
