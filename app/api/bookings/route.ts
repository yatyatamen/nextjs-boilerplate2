import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getSessionBookingRules, parseSessionStart } from "@/lib/scheduling"
import { sendSessionBookingCancellationEmail, sendSessionBookingConfirmationEmail, sendSessionBookingReminderEmail } from "@/lib/supabase/email"
import type { EmailTemplate } from "@/lib/email-templates"

function isEmailTemplate(value: unknown): value is EmailTemplate {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EmailTemplate).subject === "string" &&
      typeof (value as EmailTemplate).body === "string",
  )
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const database = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)
      ? await createServiceClient()
      : supabase
    const { data, error } = await database.from("bookings").select("session_id")
    if (error) {
      console.error("Booking counts fetch failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const counts: Record<string, number> = {}
    for (const booking of data ?? []) {
      if (booking.session_id === null) continue
      const sessionId = String(booking.session_id)
      counts[sessionId] = (counts[sessionId] ?? 0) + 1
    }

    return NextResponse.json({ data: counts })
  } catch (error) {
    console.error("Booking counts route error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load booking counts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body?.session_id === "string" || typeof body?.session_id === "number"
      ? String(body.session_id)
      : ""
    const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null

    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: session, error: sessionError } = await supabase
      .from("schedule")
      .select("id, title, date, time, max_level, notes")
      .eq("id", sessionId)
      .maybeSingle()

    if (sessionError) {
      console.error("Session lookup failed:", sessionError)
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const countDatabase = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)
      ? await createServiceClient()
      : supabase
    const { count: currentCount, error: countError } = await countDatabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)

    if (countError) {
      console.error("Booking count failed:", countError)
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    const ruleSet = getSessionBookingRules(session, currentCount ?? 0, new Date())
    if (ruleSet.isFull || ruleSet.isBookingBlocked) {
      return NextResponse.json({ error: ruleSet.bookingBlockReason || "This session is full or booking is closed." }, { status: 409 })
    }

    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", userData.user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "You have already booked this session." }, { status: 409 })
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        session_id: sessionId,
        user_id: userData.user.id,
        status: "confirmed",
        notes,
      })
      .select()

    if (error) {
      console.error("Booking create failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userData.user.id)
      .maybeSingle()

    const recipient = profile?.email?.trim() || userData.user.email?.trim() || ""
    const memberName = profile?.full_name || "Member"
    let confirmationStatus: "accepted" | "failed" | "skipped" = "skipped"
    let confirmationError: string | undefined
    let reminderStatus: "accepted" | "failed" | "disabled" | "not_due" | "skipped" = "skipped"
    let reminderError: string | undefined

    if (recipient) {
      const confirmation = await sendSessionBookingConfirmationEmail({
        to: recipient,
        memberName,
        sessionTitle: session.title || "session",
        sessionDate: session.date || "TBD",
        sessionTime: session.time || "TBD",
      })
      confirmationStatus = confirmation.ok ? "accepted" : "failed"
      if (!confirmation.ok) confirmationError = confirmation.error

      const start = parseSessionStart(session.date, session.time)
      const timeUntilStart = start ? start.getTime() - Date.now() : null
      const withinOneDay = timeUntilStart !== null && timeUntilStart <= 24 * 60 * 60 * 1000 && timeUntilStart > 0
      if (withinOneDay) {
        const reminder = await sendSessionBookingReminderEmail({
          to: recipient,
          memberName,
          sessionTitle: session.title || "session",
          sessionDate: session.date || "TBD",
          sessionTime: session.time || "TBD",
        })
        reminderStatus = reminder.ok ? "accepted" : "failed"
        if (!reminder.ok) reminderError = reminder.error
      } else {
        reminderStatus = "not_due"
      }
    } else {
      confirmationError = "No email address is available on the account or profile."
      reminderError = confirmationError
    }

    return NextResponse.json({
      data,
      email: {
        recipient: recipient || null,
        confirmation: { status: confirmationStatus, error: confirmationError },
        reminder: { status: reminderStatus, error: reminderError },
      },
    })
  } catch (error) {
    console.error("Booking route POST error:", error)
    return NextResponse.json({ error: "Unable to create booking" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const bookingId = typeof body?.booking_id === "string" || typeof body?.booking_id === "number"
      ? String(body.booking_id)
      : ""
    const cancellationTemplate = isEmailTemplate(body?.cancellation_template) ? body.cancellation_template : undefined
    const adminCancellationTemplate = isEmailTemplate(body?.admin_cancellation_template) ? body.admin_cancellation_template : undefined

    if (!bookingId) {
      return NextResponse.json({ error: "booking_id required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, session_id, user_id")
      .eq("id", bookingId)
      .maybeSingle()

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email, full_name")
      .eq("id", userData.user.id)
      .maybeSingle()
    const canCancelAnyBooking = profile?.role === "staff" || profile?.role === "admin"

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (!canCancelAnyBooking && booking.user_id !== userData.user.id) {
      return NextResponse.json({ error: "You can only cancel your own bookings" }, { status: 403 })
    }

    const { data: session } = booking.session_id
      ? await supabase
        .from("schedule")
        .select("id, title, date, time")
        .eq("id", booking.session_id)
        .maybeSingle()
      : { data: null }

    if (session && !canCancelAnyBooking) {
      const start = parseSessionStart(session.date, session.time)
      const cutoff = start ? new Date(start.getTime() - 24 * 60 * 60 * 1000) : null
      if (cutoff && new Date() >= cutoff) {
        return NextResponse.json({ error: "Cancellation is disabled within 24 hours of the session start. Please talk to the club leaders if you need help." }, { status: 409 })
      }
    }

    const database = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
      ? await createServiceClient()
      : supabase

    const { error } = await database
      .from("bookings")
      .delete()
      .eq("id", bookingId)
      .match(canCancelAnyBooking ? { id: bookingId } : { id: bookingId, user_id: userData.user.id })

    if (error) {
      console.error("Booking cancellation failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let email: { status: "accepted" | "failed" | "skipped"; error?: string } = { status: "skipped" }
    if (session) {
      const isAdminRemoval = canCancelAnyBooking && booking.user_id !== userData.user.id
      const { data: recipientProfile } = isAdminRemoval && booking.user_id
        ? await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", booking.user_id)
          .maybeSingle()
        : { data: null }
      const recipient = isAdminRemoval
        ? recipientProfile?.email?.trim() || ""
        : profile?.email?.trim() || userData.user.email?.trim() || ""
      if (recipient) {
        const result = await sendSessionBookingCancellationEmail({
          to: recipient,
          memberName: (isAdminRemoval ? recipientProfile?.full_name : profile?.full_name)?.trim() || "Member",
          sessionTitle: session.title || "session",
          sessionDate: session.date || "TBD",
          sessionTime: session.time || "TBD",
          template: isAdminRemoval ? adminCancellationTemplate : cancellationTemplate,
        })
        email = result.ok ? { status: "accepted" } : { status: "failed", error: result.error }
      } else {
        email = { status: "failed", error: "No email address is available on the account or profile." }
      }
    }

    return NextResponse.json({ success: true, email })
  } catch (error) {
    console.error("Booking route DELETE error:", error)
    return NextResponse.json({ error: "Unable to cancel booking" }, { status: 500 })
  }
}
