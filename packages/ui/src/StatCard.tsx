export interface StatCardProps {
  label: string;
  value?: number | string;
  /** Si no hay `value`, la tarjeta se muestra en estado vacío con este motivo. */
  emptyReason?: string;
}

export function StatCard({ label, value, emptyReason }: StatCardProps) {
  const isEmpty = value === undefined;

  return (
    <div className="rounded-md border border-border p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
        {label}
      </div>
      {isEmpty ? (
        <>
          <div className="mt-1 font-mono text-xl font-bold text-text-tertiary">—</div>
          {emptyReason && <div className="mt-1 text-[11px] text-text-tertiary">{emptyReason}</div>}
        </>
      ) : (
        <div className="mt-1 font-mono text-xl font-bold tabular-nums text-text">{value}</div>
      )}
    </div>
  );
}
