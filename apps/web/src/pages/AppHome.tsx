import { useAuth } from "../features/auth/AuthContext";

export function AppHome() {
  const { user, logout } = useAuth();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 48 }}>
      <h1>STOCK-C</h1>
      <p>Fase 5 — autenticación funcionando. El dashboard real se construye en la Fase 6.</p>
      {user && (
        <p>
          Sesión iniciada como <strong>{user.name}</strong> ({user.email}) — rol{" "}
          <strong>{user.role.name}</strong>.
        </p>
      )}
      <button type="button" onClick={() => void logout()}>
        Cerrar sesión
      </button>
    </main>
  );
}
