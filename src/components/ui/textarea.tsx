import { type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 w-full rounded-[12px] border border-line bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/35",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
