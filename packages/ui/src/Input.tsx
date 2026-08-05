import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const fieldClasses =
  "w-full rounded-md border bg-bg-raised px-2.5 py-2 text-[13px] text-text placeholder:text-text-tertiary focus-visible:border-accent";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(fieldClasses, invalid ? "border-danger" : "border-border-strong", className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(fieldClasses, invalid ? "border-danger" : "border-border-strong", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
