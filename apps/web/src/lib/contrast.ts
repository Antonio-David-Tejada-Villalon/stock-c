// Copia liviana de apps/api/src/lib/contrast.ts — mismo cálculo WCAG,
// duplicado a propósito para dar feedback en vivo en el formulario sin
// un round-trip solo para validar (el servidor sigue siendo la
// autoridad final, ver docs/13-configuracion-general.md).

const WHITE = "#ffffff";
const NEAR_BLACK = "#0a0a0a";
const AA_NORMAL_TEXT_RATIO = 4.5;

function channelToLinear(c: number): number {
  const normalized = c / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function passesAA(hex: string): { ok: boolean; bestRatio: number } {
  const bestRatio = Math.max(contrastRatio(hex, WHITE), contrastRatio(hex, NEAR_BLACK));
  return { ok: bestRatio >= AA_NORMAL_TEXT_RATIO, bestRatio };
}

/** Blanco o casi-negro, el que dé más contraste contra `hex` — para
 * decidir el color de texto que va arriba del acento (`--accent-contrast`). */
export function bestTextColor(hex: string): string {
  return contrastRatio(hex, WHITE) >= contrastRatio(hex, NEAR_BLACK) ? WHITE : NEAR_BLACK;
}
