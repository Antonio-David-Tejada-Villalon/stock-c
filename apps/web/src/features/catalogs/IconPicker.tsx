import { useState } from "react";
import { Input } from "@stock-c/ui";
import { CATEGORY_ICON_NAMES, CATEGORY_ICONS } from "./categoryIcons";

export interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? CATEGORY_ICON_NAMES.filter((name) => name.toLowerCase().includes(query.toLowerCase()))
    : CATEGORY_ICON_NAMES;

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Buscar ícono…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar ícono"
      />
      <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-border-strong p-2">
        {value && (
          <button
            type="button"
            title="Quitar ícono"
            onClick={() => onChange("")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-xs text-danger hover:bg-danger-wash"
          >
            ✕
          </button>
        )}
        {filtered.map((name) => {
          const Icon = CATEGORY_ICONS[name]!;
          const selected = name === value;
          return (
            <button
              key={name}
              type="button"
              title={name}
              aria-pressed={selected}
              onClick={() => onChange(name)}
              className={
                selected
                  ? "flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-contrast"
                  : "flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-sunken hover:text-text"
              }
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-8 py-2 text-center text-xs text-text-tertiary">Sin resultados</p>
        )}
      </div>
    </div>
  );
}
