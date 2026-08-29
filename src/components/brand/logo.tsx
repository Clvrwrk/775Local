import { cn } from "@/lib/utils";

export function BrandMark({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <img
      src={dark ? "/brand/mark-dark.svg" : "/brand/mark.svg"}
      alt=""
      width="64"
      height="64"
      className={cn("block shrink-0", className)}
    />
  );
}

export function BrandLogo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <img
      src={dark ? "/brand/775directory-lockup-horizontal-dark.svg" : "/brand/775directory-lockup-horizontal.svg"}
      alt="775Directory"
      width="456"
      height="128"
      className={cn("block h-auto", className)}
    />
  );
}
