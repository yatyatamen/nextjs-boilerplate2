import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { sendAbsenceEmail } from "@/lib/supabase/email"
import type { EmailTemplate } from "@/lib/email-templates"

const ATTENDANCE_ROLES = new Set(["staff", "teacher", "leader"])

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return "Unable to save attendance"
}

function isEmailTemplate(value: unknown): value is EmailTemplate {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EmailTemplate).subject === "string" &&
      typeof (value as EmailTemplate).body === "string",
  )
}

async function notifyAbsentMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string,
  previousStatus: string | null | undefined,
  nextStatus: unknown,
  template?: EmailTemplate,
) {
  if (nextStatus !== "absent" || previousStatus === "absent") return { status: "not_needed" as const }

  try {
    const [{ data: member, error: memberError }, { data: session, error: sessionError }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
      supabase.from("schedule").select("title, date, time").eq("id", sessionId).maybeSingle(),
    ])
    if (memberError) throw memberError
    if (sessionError) throw sessionError

    const recipient = member?.email?.trim()
    if (!recipient) return { status: "failed" as const, error: "Member email address is unavailable." }

    const result = await sendAbsenceEmail({
      to: recipient,
      memberName: member?.full_name?.trim() || "Member",
      sessionTitle: session?.title || "session",
      sessionDate: session?.date || "TBD",
      sessionTime: session?.time || "TBD",
      template,
    })
    return result.ok
      ? { status: "sent" as const }
      : { status: "failed" as const, error: result.error || "Unable to send absence email" }
  } catch (error) {
    console.error("Absence notification failed:", error)
    return { status: "failed" as const, error: getErrorMessage(error) }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const attendanceId = typeof body?.attendance_id === "string" || typeof body?.attendance_id === "number"
      ? String(body.attendance_id)
      : ""
    const sessionId = typeof body?.session_id === "string" || typeof body?.session_id === "number"
      ? String(body.session_id)
      : ""
    const userId = typeof body?.user_id === "string" || typeof body?.user_id === "number"
      ? String(body.user_id)
      : ""
    const status = body?.status
    const absenceTemplate = isEmailTemplate(body?.absence_template) ? body.absence_template : undefined

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
      const { data: previous, error: previousError } = await database
        .from("attendance")
        .select("status, user_id, session_id")
        .eq("id", attendanceId)
        .maybeSingle()
      if (previousError) throw previousError

      const updates: Record<string, unknown> = { status, marked_at: markedAt }
      if (typeof body?.user_name === "string") updates.user_name = body.user_name
      if (typeof body?.user_level === "string") updates.user_level = body.user_level

      const { data, error } = await database
        .from("attendance")
        .update(updates)
        .eq("id", attendanceId)
        .select()
        .single()
      if (error) throw error
      const email = previous
        ? await notifyAbsentMember(supabase, previous.user_id, String(previous.session_id), previous.status, status, absenceTemplate)
        : { status: "not_needed" as const }
      return NextResponse.json({ data, email })
    }

    const { data: existing, error: existingError } = await database
      .from("attendance")
      .select("id, status")
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
        })
        .eq("id", existing.id)
        .select()
        .single()
      if (error) throw error
      const email = await notifyAbsentMember(supabase, userId, sessionId, existing.status, status, absenceTemplate)
      return NextResponse.json({ data, email })
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
      })
      .select()
      .single()
    if (error) throw error

    const email = await notifyAbsentMember(supabase, userId, sessionId, undefined, status, absenceTemplate)
    return NextResponse.json({ data, email })
  } catch (error) {
    console.error("Attendance save failed:", error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}