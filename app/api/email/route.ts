import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { EmailTemplate } from "@/lib/email-templates"
import {
  sendAbsenceEmail,
  sendAnnouncementEmail,
  sendAssessmentEmail,
  sendSessionAlertEmail,
  sendShopUpdateEmail,
} from "@/lib/supabase/email"

type EmailEvent = "announcement" | "session_alert" | "assessment" | "absence" | "shop_update"

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

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Only staff can send these emails" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const event = body?.event as EmailEvent
    const to = requiredString(body?.to).trim()
    const template = isTemplate(body?.template) ? body.template : undefined

    if (!to || !["announcement", "session_alert", "assessment", "absence", "shop_update"].includes(event)) {
      return NextResponse.json({ error: "A valid email event and recipient are required" }, { status: 400 })
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
    } else if (event === "absence") {
      result = await sendAbsenceEmail({
        to,
        memberName: requiredString(body?.memberName),
        sessionTitle: requiredString(body?.sessionTitle),
        sessionDate: requiredString(body?.sessionDate),
        sessionTime: requiredString(body?.sessionTime),
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
