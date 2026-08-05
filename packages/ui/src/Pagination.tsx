import { Button } from "./Button";

export interface PaginationProps {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function Pagination({ onPrev, onNext, hasPrev, hasNext }: PaginationProps) {
  return (
    <div className="flex items-center justify-end gap-2 py-3">
      <Button variant="secondary" size="sm" onClick={onPrev} disabled={!hasPrev}>
        ‹ Anterior
      </Button>
      <Button variant="secondary" size="sm" onClick={onNext} disabled={!hasNext}>
        Siguiente ›
      </Button>
    </div>
  );
}
