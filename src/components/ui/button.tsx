import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
  {
    variants: {
      variant: {
        default: "bg-gold text-ink hover:bg-gold-2",
        ink: "bg-pine text-paper hover:bg-teal",
        outline: "border border-line bg-card text-ink hover:bg-paper-2",
        ghost: "text-ink hover:bg-paper-2",
        link: "text-teal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 rounded-[12px] px-4 text-sm",
        sm: "h-9 rounded-[10px] px-3 text-sm",
        lg: "h-12 rounded-[14px] px-5 text-base",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
