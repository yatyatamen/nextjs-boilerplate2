import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getMemberLevel, isSessionVisibleToLevel } from "../../../lib/session-visibility"
import type { EmailTemplate } from "@/lib/email-templates"
import {
  sendAnnouncementEmail,
  sendAssessmentEmail,
  sendSessionAlertEmail,
  sendShopUpdateEmail,
} from "@/lib/supabase/email"

export const runtime = "nodejs"

type EmailEvent = "announcement" | "session_alert" | "session_alert_batch" | "assessment" | "shop_update"

function isTemplate(value: unknown): value is EmailTemplate {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EmailTemplate).subject === "string" &&
      typeof (value as EmailTemplate).body === "string",
  )
}

function requiredString(value: unknown) {
  return typeof value === "string" ? value : ""
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    const body = await request.json().catch(() => ({}))
    const event = body?.event as EmailEvent
    const isSessionAlert = event === "session_alert" || event === "session_alert_batch"
    const canSendEmail =
      profile?.role === "staff" ||
      profile?.role === "admin" ||
      (profile?.role === "leader" && isSessionAlert)
    if (!canSendEmail) {
      return NextResponse.json({ error: "Only staff can send these emails" }, { status: 403 })
    }

    const to = requiredString(body?.to).trim()
    const template = isTemplate(body?.template) ? body.template : undefined

    if (!["announcement", "session_alert", "session_alert_batch", "assessment", "shop_update"].includes(event)) {
      return NextResponse.json({ error: "A valid email event and recipient are required" }, { status: 400 })
    }

    if (event === "session_alert_batch") {
      const sessionId = requiredString(body?.sessionId).trim()
      if (!sessionId) {
        return NextResponse.json({ error: "A session ID is required for session alert emails" }, { status: 400 })
      }

      let database = supabase
      try {
        database = await createServiceClient()
      } catch {
        // Fall back to the authenticated client when the service role is unavailable.
      }

      const [{ data: session, error: sessionError }, { data: members, error: membersError }] = await Promise.all([
        database.from("schedule").select("title, date, time, visibility_tiers").eq("id", sessionId).maybeSingle(),
        database.from("profiles").select("email, role, level"),
      ])

      if (sessionError || membersError) {
        const error = sessionError ?? membersError
        console.error("Session alert roster lookup failed:", error?.message)
        return NextResponse.json({ error: error?.message || "Unable to load session alert recipients" }, { status: 500 })
      }
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      if (!Array.isArray(session.visibility_tiers) || session.visibility_tiers.some((tier) => typeof tier !== "string")) {
        console.error("Session alert blocked because saved visibility ranks are missing or invalid.", { sessionId })
        return NextResponse.json({ error: "This session has no valid saved visibility ranks; no emails were sent." }, { status: 409 })
      }

      const recipients = (members ?? []).filter((member) =>
        getMemberLevel(member.role, member.level) !== null &&
        Boolean(member.email?.trim()) &&
        isSessionVisibleToLevel(session.visibility_tiers, getMemberLevel(member.role, member.level)),
      )
      let sent = 0
      let failed = 0
      let firstError: string | undefined
      for (const recipient of recipients) {
        const result = await sendSessionAlertEmail({
          to: recipient.email!.trim(),
          title: requiredString(session.title) || "Training Session",
          date: requiredString(session.date) || "TBD",
          time: requiredString(session.time) || "TBD",
          template,
        })
        if (result.ok) sent += 1
        else {
          failed += 1
          firstError ||= result.error || "Unable to send session alert"
        }
      }

      return NextResponse.json({ data: { sent, failed, attempted: recipients.length, error: firstError } })
    }

    if (!to) {
      return NextResponse.json({ error: "A valid email event and recipient are required" }, { status: 400 })
    }

    if (event === "session_alert") {
      const sessionId = requiredString(body?.sessionId).trim()
      if (!sessionId) {
        return NextResponse.json({ error: "A session ID is required for session alert emails" }, { status: 400 })
      }

      let database = supabase
      try {
        database = await createServiceClient()
      } catch {
        // Fall back to the authenticated client when the service role is unavailable.
      }

      const [{ data: session, error: sessionError }, { data: recipient, error: recipientError }] = await Promise.all([
        database.from("schedule").select("visibility_tiers").eq("id", sessionId).maybeSingle(),
        database.from("profiles").select("role, level").eq("email", to).maybeSingle(),
      ])

      if (sessionError || recipientError) {
        const error = sessionError ?? recipientError
        console.error("Session alert eligibility lookup failed:", error?.message)
        return NextResponse.json({ error: "Unable to verify session alert recipient eligibility" }, { status: 500 })
      }
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      if (
        !isSessionVisibleToLevel(
          session.visibility_tiers,
          getMemberLevel(recipient?.role, recipient?.level),
        )
      ) {
        return NextResponse.json({ error: "Recipient is not eligible for this session alert" }, { status: 403 })
      }
    }

    let result
    if (event === "announcement") {
      result = await sendAnnouncementEmail({
        to,
        title: requiredString(body?.title),
        content: requiredString(body?.content),
        template,
      })
    } else if (event === "session_alert") {
      result = await sendSessionAlertEmail({
        to,
        title: requiredString(body?.sessionTitle),
        date: requiredString(body?.sessionDate),
        time: requiredString(body?.sessionTime),
        template,
      })
    } else if (event === "assessment") {
      result = await sendAssessmentEmail({
        to,
        memberName: requiredString(body?.memberName),
        level: requiredString(body?.level),
        template,
      })
    } else {
      result = await sendShopUpdateEmail({
        to,
        itemName: requiredString(body?.itemName),
        template,
      })
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Unable to send email" }, { status: 502 })
    }

    return NextResponse.json({ data: { id: result.id } })
  } catch (error) {
    console.error("Email route error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send email" }, { status: 500 })
  }
}
