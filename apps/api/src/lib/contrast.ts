// Contraste WCAG 2.2 (luminancia relativa sRGB) — misma fórmula que ya
// se usó a mano para descartar el Naranja de marca como --accent único
// en la adenda de branding (docs/02-diseno-ui-ux.md). Acá se aplica en
// código para validar el color de acento que cada empresa elija (Fase
// 13), en vez de restringir a una lista cerrada de presets.

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const WHITE = "#ffffff";
export const NEAR_BLACK = "#0a0a0a";
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

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pasa si el color tiene contraste AA suficiente contra blanco O contra
 * un texto casi-negro — alcanza con que uno de los dos combine bien,
 * igual que Electric Blue (blanco encima) y el resto de los textos
 * oscuros del sistema. */
export function passesAA(hex: string): { ok: boolean; bestRatio: number } {
  const vsWhite = contrastRatio(hex, WHITE);
  const vsNearBlack = contrastRatio(hex, NEAR_BLACK);
  const bestRatio = Math.max(vsWhite, vsNearBlack);
  return { ok: bestRatio >= AA_NORMAL_TEXT_RATIO, bestRatio };
}

export function isValidHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}
