import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ATTENDANCE_ROLES = new Set(["leader", "staff", "teacher"])
const MIGRATION_ERROR =
  "Manual attendance additions aren't configured. Apply supabase/migration/20261125090000_attendance_booking_risk.sql, then supabase/migration/20261125100000_manual_attendance_roster.sql."

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "PGRST202" || error.code === "PGRST205") return MIGRATION_ERROR
  }
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return "Unable to update the attendance roster."
}

async function getAttendanceManager() {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle()
  if (profileError) throw profileError
  if (!ATTENDANCE_ROLES.has(String(profile?.role ?? ""))) {
    return { response: NextResponse.json({ error: "Attendance access denied" }, { status: 403 }) }
  }

  return { supabase, response: null }
}

export async function GET() {
  try {
    const manager = await getAttendanceManager()
    if (manager.response) return manager.response

    const { data, error } = await manager.supabase
      .from("attendance_manual_roster")
      .select("session_id, user_id, created_at")
      .order("created_at", { ascending: false })
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Manual attendance roster load failed:", error)
    const message = getErrorMessage(error)
    const status = message === MIGRATION_ERROR ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : ""
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : ""
    if (!sessionId || !userId) {
      return NextResponse.json({ error: "A session and member are required." }, { status: 400 })
    }

    const manager = await getAttendanceManager()
    if (manager.response) return manager.response

    const { data, error } = await manager.supabase.rpc("add_attendance_roster_member", {
      p_session_id: sessionId,
      p_user_id: userId,
    })
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Manual attendance roster update failed:", error)
    const message = getErrorMessage(error)
    const errorCode = typeof error === "object" && error !== null && "code" in error ? error.code : null
    const status = message === MIGRATION_ERROR ? 503 : errorCode === "P0001" ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
