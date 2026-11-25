import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MANAGEMENT_ROLES = new Set(["leader", "staff", "teacher"])
const RISK_REASON_LABELS: Record<string, string> = {
  absent: "absence",
  late: "late arrival",
  forgot_signup: "forgot to sign up",
}

function getCurrentMonthStart() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "PGRST202" || error.code === "PGRST205")
  ) {
    return "Attendance booking eligibility isn't configured. Apply supabase/migration/20261125090000_attendance_booking_risk.sql, supabase/migration/20261125100000_manual_attendance_roster.sql, and supabase/migration/20261125150000_track_leader_attendance_risk.sql, then reload."
  }
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return fallback
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle()
    if (profileError) throw profileError

    const isManagement = MANAGEMENT_ROLES.has(String(profile?.role ?? ""))
    if (!isManagement && profile?.role !== "member") {
      return NextResponse.json({ error: "Attendance risk access denied" }, { status: 403 })
    }

    const monthStart = getCurrentMonthStart()
    let riskQuery = supabase
      .from("attendance_booking_risk")
      .select("user_id, risk_percent, month_start")
    let checkQuery = supabase
      .from("attendance_booking_risk_checks")
      .select("user_id, session_id, risk_percent, month_start")
      .eq("allowed", false)
    let eventQuery = supabase
      .from("attendance_booking_risk_events")
      .select("user_id, status")
      .eq("month_start", monthStart)

    if (!isManagement) {
      riskQuery = riskQuery.eq("user_id", userData.user.id)
      checkQuery = checkQuery.eq("user_id", userData.user.id)
      eventQuery = eventQuery.eq("user_id", userData.user.id)
    }

    const [
      { data: risks, error: riskError },
      { data: checks, error: checksError },
      { data: events, error: eventsError },
    ] = await Promise.all([
      riskQuery,
      checkQuery,
      eventQuery,
    ])
    if (riskError) throw riskError
    if (checksError) throw checksError
    if (eventsError) throw eventsError

    const blockedSessions = new Map<string, string[]>()
    const blockedSessionRiskPercents = new Map<string, Record<string, number>>()
    for (const check of checks ?? []) {
      const userId = String(check.user_id)
      const sessionId = String(check.session_id)
      blockedSessions.set(userId, [...(blockedSessions.get(userId) ?? []), sessionId])
      blockedSessionRiskPercents.set(userId, {
        ...(blockedSessionRiskPercents.get(userId) ?? {}),
        [sessionId]: Number(check.risk_percent),
      })
    }

    const reasonsByUser = new Map<string, string[]>()
    for (const event of events ?? []) {
      const label = RISK_REASON_LABELS[String(event.status)]
      if (!label) continue
      const userId = String(event.user_id)
      const reasons = reasonsByUser.get(userId) ?? []
      if (!reasons.includes(label)) reasonsByUser.set(userId, [...reasons, label])
    }

    const data = (risks ?? []).map((risk) => ({
      user_id: String(risk.user_id),
      risk_percent: risk.month_start === monthStart ? Number(risk.risk_percent) : 0,
      month_start: monthStart,
      suspended_session_ids: blockedSessions.get(String(risk.user_id)) ?? [],
      suspended_session_risk_percent_by_id: blockedSessionRiskPercents.get(String(risk.user_id)) ?? {},
      suspension_reasons: reasonsByUser.get(String(risk.user_id)) ?? [],
    }))

    if (profile?.role === "leader" && !data.some((entry) => entry.user_id === userData.user.id)) {
      data.push({
        user_id: userData.user.id,
        risk_percent: 0,
        month_start: monthStart,
        suspended_session_ids: blockedSessions.get(userData.user.id) ?? [],
        suspended_session_risk_percent_by_id: blockedSessionRiskPercents.get(userData.user.id) ?? {},
        suspension_reasons: reasonsByUser.get(userData.user.id) ?? [],
      })
    }

    if (!isManagement && data.length === 0) {
      data.push({
        user_id: userData.user.id,
        risk_percent: 0,
        month_start: monthStart,
        suspended_session_ids: blockedSessions.get(userData.user.id) ?? [],
        suspended_session_risk_percent_by_id: blockedSessionRiskPercents.get(userData.user.id) ?? {},
        suspension_reasons: reasonsByUser.get(userData.user.id) ?? [],
      })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Attendance risk fetch failed:", error)
    return NextResponse.json(
      { error: getErrorMessage(error, "Unable to load attendance risk") },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : ""
    const riskPercent = typeof body?.risk_percent === "number" ? body.risk_percent : Number.NaN
    if (!userId || !Number.isFinite(riskPercent) || riskPercent < 0 || riskPercent > 100) {
      return NextResponse.json({ error: "A tracked member or leader and percentage between 0 and 100 are required." }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (profile?.role !== "leader" && profile?.role !== "staff") {
      return NextResponse.json({ error: "Only leaders and staff can change attendance risk." }, { status: 403 })
    }

    const { data, error } = await supabase.rpc("set_attendance_booking_risk", {
      p_user_id: userId,
      p_risk_percent: riskPercent,
    })
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Attendance risk update failed:", error)
    return NextResponse.json(
      { error: getErrorMessage(error, "Unable to update attendance risk") },
      { status: 500 },
    )
  }
}
