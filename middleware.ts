import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { isMaintenanceActive, MAINTENANCE_REOPEN_AT } from "@/lib/maintenance"

// 💡 FIX: Next.js explicitly needs the function to be named "middleware" and exported
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/_next/")) {
    return NextResponse.next()
  }

  if (process.env.NODE_ENV === "production" && isMaintenanceActive()) {
    if (pathname === "/maintenance") {
      return NextResponse.next()
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "The website is temporarily unavailable for scheduled maintenance.",
          reopensAt: MAINTENANCE_REOPEN_AT,
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(Math.max(1, Math.ceil((Date.parse(MAINTENANCE_REOPEN_AT) - Date.now()) / 1000))),
          },
        },
      )
    }

    const maintenanceUrl = request.nextUrl.clone()
    maintenanceUrl.pathname = "/maintenance"
    maintenanceUrl.search = ""
    return NextResponse.rewrite(maintenanceUrl)
  }

  if (pathname === "/maintenance") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}