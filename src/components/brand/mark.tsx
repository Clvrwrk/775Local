export function CircleMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="16" cy="16" r="14.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 21.5 L16 10.5 L24 21.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M11.5 21.5 L16 15 L20.5 21.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
