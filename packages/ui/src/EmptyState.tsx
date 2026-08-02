export interface EmptyStateProps {
  glyph?: string;
  title: string;
  description?: string;
}

export function EmptyState({ glyph = "\u{1F4E6}", title, description }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong px-6 py-8 text-center text-text-secondary">
      <div className="mb-2 text-xl" aria-hidden="true">
        {glyph}
      </div>
      <div className="text-sm font-semibold text-text">{title}</div>
      {description && <div className="mt-1 text-[13px]">{description}</div>}
    </div>
  );
}
