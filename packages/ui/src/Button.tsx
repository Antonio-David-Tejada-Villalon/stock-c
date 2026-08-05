import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md font-heading font-semibold transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
        secondary:
          "bg-bg-raised text-text border border-border-strong hover:border-accent hover:text-accent",
        ghost: "bg-transparent text-text-secondary hover:bg-bg-sunken hover:text-text",
        danger: "bg-danger text-white hover:brightness-110",
      },
      size: {
        sm: "text-xs px-2.5 py-1.5",
        md: "text-[13px] px-3.5 py-2",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
