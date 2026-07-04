import { cn } from "@/lib/utils"

export function Logo({
  className,
  showText = true,
  onDark = false,
}: {
  className?: string
  showText?: boolean
  onDark?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShuttleIcon className="h-5 w-5" />
      </span>
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "text-sm font-semibold tracking-tight",
              onDark ? "text-sidebar-foreground" : "text-foreground",
            )}
          >
            Westmount
          </span>
          <span
            className={cn(
              "text-xs",
              onDark ? "text-sidebar-foreground/60" : "text-muted-foreground",
            )}
          >
            Badminton Club
          </span>
        </div>
      )}
    </div>
  )
}

export function ShuttleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="18" r="3" />
      <path d="M12 15 L6 4" />
      <path d="M12 15 L18 4" />
      <path d="M12 15 L9.5 3.5" />
      <path d="M12 15 L14.5 3.5" />
      <path d="M6 4 L18 4" />
      <path d="M8 8.5 L16 8.5" />
    </svg>
  )
}
