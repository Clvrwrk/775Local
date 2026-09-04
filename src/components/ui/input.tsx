import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-[12px] border border-line bg-card px-3.5 text-sm text-ink placeholder:text-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
