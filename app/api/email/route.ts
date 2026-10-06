import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { isSessionVisibleToLevel } from "../../../lib/session-visibility"
import type { EmailTemplate } from "@/lib/email-templates"
import {
  sendAnnouncementEmail,
  sendAssessmentEmail,
  sendSessionAlertEmail,
  sendShopUpdateEmail,
} from "@/lib/supabase/email"

export const runtime = "nodejs"

type EmailEvent = "announcement" | "session_alert" | "assessment" | "shop_update"

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
    const canSendEmail =
      profile?.role === "staff" ||
      profile?.role === "admin" ||
      (profile?.role === "leader" && event === "session_alert")
    if (!canSendEmail) {
      return NextResponse.json({ error: "Only staff can send these emails" }, { status: 403 })
    }

    const to = requiredString(body?.to).trim()
    const template = isTemplate(body?.template) ? body.template : undefined

    if (!to || !["announcement", "session_alert", "assessment", "shop_update"].includes(event)) {
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
        String(recipient?.role ?? "").trim().toLowerCase() !== "member" ||
        !isSessionVisibleToLevel(session.visibility_tiers, recipient?.level)
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
