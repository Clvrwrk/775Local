import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-xs font-medium text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}
