// Aritmética decimal exacta vía bigint de punto fijo (4 decimales) — el
// resto del proyecto evita floats para valores monetarios/cantidades
// delegando en el $inc nativo de Mongo sobre Decimal128 (Fase 9); acá no
// hay un solo campo para incrementar (son sumas/productos sobre muchos
// documentos en memoria para un reporte), así que se necesita esta
// versión explícita del mismo principio. Ver docs/11-reportes.md, §2.
const SCALE = 10_000n;

/** "Cero" con el mismo formato que devuelve cualquier suma — evita que un
 * total sin movimientos se vea como "0" mientras el resto usa "X.XXXX". */
export const ZERO_DECIMAL = "0.0000";

export function parseDecimal(value: string): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, frac = ""] = unsigned.split(".");
  const fracPadded = (frac + "0000").slice(0, 4);
  const scaled = BigInt(whole || "0") * SCALE + BigInt(fracPadded);
  return negative ? -scaled : scaled;
}

export function formatDecimal(scaled: bigint): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const whole = abs / SCALE;
  const frac = abs % SCALE;
  return `${negative ? "-" : ""}${whole}.${frac.toString().padStart(4, "0")}`;
}

export function addDecimal(a: string, b: string): string {
  return formatDecimal(parseDecimal(a) + parseDecimal(b));
}

export function subDecimal(a: string, b: string): string {
  return formatDecimal(parseDecimal(a) - parseDecimal(b));
}

export function multiplyDecimal(a: string, b: string): string {
  return formatDecimal((parseDecimal(a) * parseDecimal(b)) / SCALE);
}

export function compareDecimal(a: string, b: string): number {
  const diff = parseDecimal(a) - parseDecimal(b);
  return diff === 0n ? 0 : diff < 0n ? -1 : 1;
}
