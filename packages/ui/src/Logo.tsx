import { cn } from "./cn";

export interface LogoMarkProps {
  /** Alto en px del isotipo. El ancho sigue el aspect ratio del viewBox. */
  size?: number;
  className?: string;
}

/**
 * Isotipo hexagonal "C" — recreación en SVG a partir de
 * stockc_brand_guidelines.webp (no había un vector original). Usa
 * --brand-mark (Naranja de marca) a propósito, nunca --accent: el
 * contraste de texto no aplica a un logo, así que puede usar el naranja
 * puro sin el ajuste que sí necesita --accent para pasar WCAG AA (ver
 * packages/ui/tokens.css).
 */
export function LogoMark({ size = 24, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0 text-brand-mark", className)}
      aria-hidden="true"
    >
      <path
        d="M21.5 6.474 10.5 6.474 5 16 10.5 25.526 21.5 25.526"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface LogoProps extends LogoMarkProps {
  /** Muestra "CONNECTED INVENTORY" debajo del wordmark (lockup completo). */
  tagline?: boolean;
}

/** Lockup horizontal: isotipo + wordmark "Stock-C", en Inter (--font-heading). */
export function Logo({ size = 24, tagline = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <div className="flex flex-col leading-none">
        <span className="font-heading text-[15px] font-bold text-text">Stock-C</span>
        {tagline && (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">
            Connected Inventory
          </span>
        )}
      </div>
    </div>
  );
}
