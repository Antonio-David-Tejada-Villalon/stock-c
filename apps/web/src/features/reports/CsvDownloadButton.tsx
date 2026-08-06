import { Button } from "@stock-c/ui";
import { toCsv, downloadCsv, type CsvColumn } from "../../lib/csv";

export interface CsvDownloadButtonProps<T> {
  rows: T[];
  columns: CsvColumn<T>[];
  filename: string;
  label?: string;
}

export function CsvDownloadButton<T>({ rows, columns, filename, label = "Descargar CSV" }: CsvDownloadButtonProps<T>) {
  return (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, toCsv(rows, columns))}
    >
      {label}
    </Button>
  );
}
