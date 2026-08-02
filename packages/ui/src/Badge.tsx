import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current",
  {
    variants: {
      variant: {
        success: "bg-success-wash text-success",
        warning: "bg-warning-wash text-warning",
        danger: "bg-danger-wash text-danger",
        neutral: "bg-bg-sunken text-text-secondary",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, variant, className }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
