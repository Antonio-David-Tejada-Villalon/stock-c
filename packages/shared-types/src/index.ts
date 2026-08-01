// Placeholder — los tipos de dominio (Product, StockMovement, etc.) se
// agregan a partir de la Fase 7 en adelante, sobre el modelo definido en
// docs/03-modelo-datos.md. Este paquete existe desde ya para que
// apps/web y apps/api compartan tipos sin duplicarlos.

export interface HealthStatus {
  status: "ok" | "error";
  service: string;
  timestamp: string;
}
