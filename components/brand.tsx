import { cn } from "@/lib/utils"

const LOGO_IMAGE_URL =
  "https://jmlhdtltucwhxrrunenl.supabase.co/storage/v1/object/public/pics/Screenshot%202026-07-18%20191727.png"

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
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={LOGO_IMAGE_URL}
        alt="Westmount Badminton Club logo"
        className="h-12 w-12 rounded-xl object-cover"
      />
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "text-base font-semibold tracking-tight",
              onDark ? "text-sidebar-foreground" : "text-foreground",
            )}
          >
            Westmount
          </span>
          <span
            className={cn(
              "text-sm",
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
