import type { ReactNode } from "react";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  helper?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, helper, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-text-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : helper ? (
        <span className="text-xs text-text-tertiary">{helper}</span>
      ) : null}
    </div>
  );
}
