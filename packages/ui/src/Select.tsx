import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-md border bg-bg-raised px-2.5 py-2 text-[13px] text-text focus-visible:border-accent",
        invalid ? "border-danger" : "border-border-strong",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";
