import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { LEVELS } from "@/lib/types"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return "Unable to post schedule session"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const requestedDate = typeof body?.date === "string" ? body.date.trim() : ""
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? new Date(`${requestedDate}T00:00:00.000Z`)
      : null
    const time = body?.time == null
      ? null
      : typeof body.time === "string" ? body.time.trim() || null : undefined
    if (
      !parsedDate ||
      !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== requestedDate ||
      time === undefined
    ) {
      return NextResponse.json({ error: "A valid session date is required, and the time must be text when provided." }, { status: 400 })
    }

    const publishAtValue = typeof body?.publish_at === "string" ? body.publish_at.trim() : ""
    const publishAt = publishAtValue ? new Date(publishAtValue) : null
    if (publishAtValue && (!publishAt || !Number.isFinite(publishAt.getTime()))) {
      return NextResponse.json({ error: "The scheduled post time is invalid" }, { status: 400 })
    }

    const isEvent = body.is_event === true
    const capacity = body.max_capacity == null || body.max_capacity === ""
      ? null
      : Number(body.max_capacity)
    if (!isEvent && capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      return NextResponse.json({ error: "Capacity must be a positive whole number" }, { status: 400 })
    }

    let visibilityTiers: string[]
    if (isEvent) {
      visibilityTiers = [...LEVELS]
    } else if (Array.isArray(body.visibility_tiers)) {
      const requestedTiers = body.visibility_tiers.map((tier: unknown) => {
        if (typeof tier !== "string") return null
        return LEVELS.find((level) => level.toLowerCase() === tier.trim().toLowerCase()) ?? null
      })
      if (requestedTiers.some((tier: string | null) => tier === null)) {
        return NextResponse.json({ error: "Visible member levels are invalid" }, { status: 400 })
      }
      visibilityTiers = requestedTiers.filter((tier: string | null): tier is string => tier !== null)
    } else {
      return NextResponse.json({ error: "Visible member levels are invalid" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single()
    const role = String(profile?.role ?? "").trim().toLowerCase()
    if (profileError || !["staff", "leader", "teacher", "admin"].includes(role)) {
      return NextResponse.json({ error: "Schedule access denied" }, { status: 403 })
    }

    const now = new Date()
    const publishImmediately = !publishAt || publishAt <= now
    let database = supabase
    try {
      database = await createServiceClient()
    } catch {
      // Use the authenticated client when the service role is unavailable.
    }
    const { data: existingSessions, error: existingSessionsError } = await database
      .from("schedule")
      .select("date")
    if (existingSessionsError) throw existingSessionsError

    const occupiedDates = new Set((existingSessions ?? [])
      .map((session) => String(session.date ?? "").slice(0, 10)))
    let sessionDate = requestedDate
    while (occupiedDates.has(sessionDate)) {
      const nextDate = new Date(`${sessionDate}T00:00:00.000Z`)
      nextDate.setUTCDate(nextDate.getUTCDate() + 1)
      sessionDate = nextDate.toISOString().slice(0, 10)
    }

    const { data, error } = await database
      .from("schedule")
      .insert({
        date: sessionDate,
        time,
        is_event: isEvent,
        publish_at: !publishImmediately && publishAt ? publishAt.toISOString() : null,
        published_at: isEvent && publishImmediately ? now.toISOString() : null,
        max_level: typeof body.max_level === "string"
          ? body.max_level
          : typeof body.level === "string" ? body.level : null,
        max_capacity: isEvent ? null : capacity,
        visibility_tiers: [...new Set(visibilityTiers)],
        coach: typeof body.coach === "string" ? body.coach : null,
        title: typeof body.title === "string" ? body.title : isEvent ? "Club Event" : "Training Session",
        notes: typeof body.notes === "string" ? body.notes : null,
      })
      .select()
      .single()
    if (error) throw error

    const dateShiftedFrom = sessionDate === requestedDate ? null : requestedDate

    if (!isEvent && publishImmediately) {
      const { error: snapshotError } = await database.rpc("snapshot_attendance_booking_risk_for_session", {
        p_session_id: String(data.id),
      })
      if (snapshotError) {
        if (snapshotError.code === "PGRST202" || snapshotError.code === "PGRST205") {
          return NextResponse.json({
            error: "Session-specific booking eligibility is not configured. Apply supabase/migration/20261125130000_session_booking_eligibility_snapshots.sql, then retry.",
          }, { status: 503 })
        }
        throw snapshotError
      }

      const { data: publishedSession, error: publishError } = await database
        .from("schedule")
        .update({ published_at: now.toISOString() })
        .eq("id", data.id)
        .select()
        .single()
      if (publishError) throw publishError
      return NextResponse.json({ data: publishedSession, date_shifted_from: dateShiftedFrom })
    }

    return NextResponse.json({ data, date_shifted_from: dateShiftedFrom })
  } catch (error) {
    console.error("Schedule create failed:", error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}