import { NextResponse } from "next/server"
import { getMemberLevel, isSessionVisibleToLevel } from "@/lib/session-visibility"
import { mergeEmailTemplateConfig } from "@/lib/email-templates"
import { formatSessionTime } from "@/lib/scheduling"
import { createServiceClient } from "@/lib/supabase/server"
import { getAutoEmailConfig, sendSessionAlertEmail } from "@/lib/supabase/email"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const database = await createServiceClient()
    const now = new Date()
    const { data: dueSessions, error: sessionsError } = await database
      .from("schedule")
      .select("id, title, date, time, visibility_tiers, is_event, publish_at")
      .lte("publish_at", now.toISOString())
      .is("published_at", null)
      .order("publish_at", { ascending: true })
      .limit(100)
    if (sessionsError) throw sessionsError
    if (!dueSessions?.length) return NextResponse.json({ data: { published: 0, emailsSent: 0, emailsFailed: 0 } })

    const deliverySettings = await getAutoEmailConfig(database)
    const shouldSendSessionAlerts = deliverySettings.session_alert
    const [{ data: storedTemplates, error: templatesError }, { data: members, error: membersError }] = shouldSendSessionAlerts
      ? await Promise.all([
        database.from("email_template_settings").select("templates").eq("id", true).maybeSingle(),
        database.from("profiles").select("email, role, level"),
      ])
      : [{ data: null, error: null }, { data: null, error: null }]
    if (templatesError) throw templatesError
    if (membersError) throw membersError
    const sessionAlertTemplate = mergeEmailTemplateConfig(storedTemplates?.templates).session_alert

    let published = 0
    let emailsSent = 0
    let emailsFailed = 0
    let firstEmailError: string | undefined

    for (const session of dueSessions) {
      if (!session.is_event) {
        const { error: snapshotError } = await database.rpc("snapshot_attendance_booking_risk_for_session", {
          p_session_id: String(session.id),
        })
        if (snapshotError) throw snapshotError
      }

      const { data: newlyPublished, error: publishError } = await database
        .from("schedule")
        .update({ published_at: now.toISOString() })
        .eq("id", session.id)
        .is("published_at", null)
        .lte("publish_at", now.toISOString())
        .select("id")
        .maybeSingle()
      if (publishError) throw publishError
      if (!newlyPublished) continue
      published += 1

      if (!shouldSendSessionAlerts || session.is_event) continue
      if (!Array.isArray(session.visibility_tiers) || session.visibility_tiers.some((tier) => typeof tier !== "string")) {
        console.error("Scheduled session published without valid visibility tiers; no alert emails sent.", { sessionId: session.id })
        continue
      }

      const recipients = (members ?? []).filter((member) =>
        getMemberLevel(member.role, member.level) !== null &&
        Boolean(member.email?.trim()) &&
        isSessionVisibleToLevel(session.visibility_tiers, getMemberLevel(member.role, member.level)),
      )
      for (const recipient of recipients) {
        const result = await sendSessionAlertEmail({
          to: recipient.email!.trim(),
          title: session.title || "Training Session",
          date: session.date || "TBD",
          time: formatSessionTime(session.time),
          template: sessionAlertTemplate,
        })
        if (result.ok) emailsSent += 1
        else {
          emailsFailed += 1
          firstEmailError ||= result.error || "Unable to send scheduled session alert"
        }
      }
    }

    if (firstEmailError) console.error("Scheduled session alert failures:", firstEmailError)
    return NextResponse.json({
      data: { published, emailsSent, emailsFailed, error: firstEmailError },
    })
  } catch (error) {
    console.error("Scheduled session publisher failed:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to publish scheduled sessions",
    }, { status: 500 })
  }
}
