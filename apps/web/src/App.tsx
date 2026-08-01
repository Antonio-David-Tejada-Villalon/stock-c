import { useEffect, useState } from "react";

type ApiStatus = "checking" | "ok" | "error";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => (res.ok ? setApiStatus("ok") : setApiStatus("error")))
      .catch(() => setApiStatus("error"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "48px" }}>
      <h1>STOCK-C</h1>
      <p>Fase 4 — configuración del proyecto. Sin funcionalidades todavía.</p>
      <p>
        Estado del API (<code>{API_URL}</code>):{" "}
        <strong>
          {apiStatus === "checking" && "verificando…"}
          {apiStatus === "ok" && "conectado ✓"}
          {apiStatus === "error" && "sin conexión"}
        </strong>
      </p>
    </main>
  );
}
