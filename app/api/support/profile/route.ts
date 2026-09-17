import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const memberId = typeof body?.memberId === "string" ? body.memberId : undefined
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : undefined
    const rawLevel = typeof body?.level === "string" ? body.level.trim() : undefined
    const rawRole = typeof body?.role === "string" ? body.role.trim() : undefined
    const memberLevel = typeof body?.member_level === "string" ? body.member_level.trim() : undefined
    const marketingEmails = typeof body?.marketing_emails === "boolean" ? body.marketing_emails : undefined
    const sessionReminderEmails = typeof body?.session_reminder_emails === "boolean" ? body.session_reminder_emails : undefined
    const sessionAlertEmails = typeof body?.session_alert_emails === "boolean" ? body.session_alert_emails : undefined

    const validRoles = new Set(["staff", "teacher", "admin", "coach", "for fun", "member"])
    const normalizedRole = rawRole && validRoles.has(rawRole.toLowerCase()) ? rawRole.toLowerCase() : undefined
    const normalizedLevel = rawLevel && !validRoles.has(rawLevel.toLowerCase()) ? rawLevel : undefined
    const level = normalizedLevel ?? (memberLevel && !validRoles.has(memberLevel.toLowerCase()) ? memberLevel : undefined)
    const role = normalizedRole ?? (rawRole && validRoles.has(rawRole.toLowerCase()) ? rawRole.toLowerCase() : undefined)

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 })
    }

    if (!fullName && !level && !role && !memberLevel && marketingEmails === undefined && sessionReminderEmails === undefined && sessionAlertEmails === undefined) {
      return NextResponse.json({ error: "At least one valid profile detail or email preference is required" }, { status: 400 })
    }

    try {
      const supabase = await createServiceClient()

      const updateData: Record<string, string | boolean | undefined> = {}
      if (fullName) updateData.full_name = fullName
      if (level) updateData.level = level
      if (role) updateData.role = role
      if (!level && memberLevel) updateData.member_level = memberLevel
      if (marketingEmails !== undefined) updateData.marketing_emails = marketingEmails
      if (sessionReminderEmails !== undefined) updateData.session_reminder_emails = sessionReminderEmails
      if (sessionAlertEmails !== undefined) updateData.session_alert_emails = sessionAlertEmails

      const updateProfile = async (payload: Record<string, string | boolean | undefined>) =>
        await supabase
          .from("profiles")
          .update(payload)
          .eq("id", memberId)
          .select()

      let result = await updateProfile(updateData)

      if (
        result.error &&
        result.error.message?.includes("column \"level\" does not exist") &&
        level &&
        !memberLevel
      ) {
        result = await updateProfile({ ...updateData, level: undefined, member_level: level })
      }

      if (
        result.error &&
        result.error.message?.includes("column \"member_level\" does not exist") &&
        memberLevel &&
        !level
      ) {
        result = await updateProfile({ ...updateData, member_level: undefined, level: memberLevel })
      }

      const { data, error } = result
      if (error) {
        console.error("Profile update error:", error)
        return NextResponse.json(
          {
            error: error.message ?? "Failed to update profile",
            details: error.details ?? null,
          },
          { status: 500 },
        )
      }

      if (!data || data.length === 0) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 })
      }

      return NextResponse.json({ data: data[0] })
    } catch (dbErr) {
      console.error("Profile update database error:", dbErr)
      return NextResponse.json({ error: String(dbErr) ?? "Database error" }, { status: 500 })
    }
  } catch (err) {
    console.error("Profile PATCH error:", err)
    return NextResponse.json({ error: String(err) ?? "failed" }, { status: 500 })
  }
}
