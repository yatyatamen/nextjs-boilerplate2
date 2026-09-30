import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const ATTENDANCE_ROLES = new Set(["staff", "admin", "teacher"])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const attendanceId = typeof body?.attendance_id === "string" ? body.attendance_id : ""
    const sessionId = typeof body?.session_id === "string" || typeof body?.session_id === "number"
      ? String(body.session_id)
      : ""
    const userId = typeof body?.user_id === "string" || typeof body?.user_id === "number"
      ? String(body.user_id)
      : ""
    const status = body?.status

    if (!attendanceId && (!sessionId || !userId)) {
      return NextResponse.json({ error: "session_id and user_id required" }, { status: 400 })
    }
    if (!["present", "absent", "late"].includes(status)) {
      return NextResponse.json({ error: "Invalid attendance status" }, { status: 400 })
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
      .single()
    if (profileError || !profile || !ATTENDANCE_ROLES.has(profile.role)) {
      return NextResponse.json({ error: "Attendance access denied" }, { status: 403 })
    }

    const database = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)
      ? await createServiceClient()
      : supabase
    const markedAt = new Date().toISOString()

    if (attendanceId) {
      const updates: Record<string, unknown> = { status, marked_at: markedAt }
      if (typeof body?.user_name === "string") updates.user_name = body.user_name
      if (typeof body?.user_level === "string") updates.user_level = body.user_level
      if (typeof body?.notes === "string" || body?.notes === null) updates.notes = body.notes

      const { data, error } = await database
        .from("attendance")
        .update(updates)
        .eq("id", attendanceId)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ data })
    }

    const { data: existing, error: existingError } = await database
      .from("attendance")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing) {
      const { data, error } = await database
        .from("attendance")
        .update({
          user_name: typeof body?.user_name === "string" ? body.user_name : "Unknown",
          user_level: typeof body?.user_level === "string" ? body.user_level : "Unknown",
          status,
          marked_at: markedAt,
          notes: typeof body?.notes === "string" ? body.notes : null,
        })
        .eq("id", existing.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ data })
    }

    const { data, error } = await database
      .from("attendance")
      .insert({
        session_id: sessionId,
        user_id: userId,
        user_name: typeof body?.user_name === "string" ? body.user_name : "Unknown",
        user_level: typeof body?.user_level === "string" ? body.user_level : "Unknown",
        status,
        marked_at: markedAt,
        notes: typeof body?.notes === "string" ? body.notes : null,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Attendance save failed:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save attendance" }, { status: 500 })
  }
}