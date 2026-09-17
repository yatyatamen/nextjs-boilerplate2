import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getSessionBookingRules } from "@/lib/scheduling"
import { sendSessionBookingConfirmationEmail, sendSessionBookingReminderEmail } from "@/lib/supabase/email"

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
      .select("id, title, date, time, max_capacity, notes")
      .eq("id", sessionId)
      .maybeSingle()

    if (sessionError) {
      console.error("Session lookup failed:", sessionError)
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const { count: currentCount, error: countError } = await supabase
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
      .select("email, full_name, session_reminder_emails")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (profile?.email) {
      const memberName = `${profile.full_name || "Member"}`
      await sendSessionBookingConfirmationEmail({
        to: profile.email,
        memberName,
        sessionTitle: session.title || "session",
        sessionDate: session.date || "TBD",
        sessionTime: session.time || "TBD",
      })

      const shouldSendReminder = profile.session_reminder_emails !== false
      if (shouldSendReminder) {
        const start = new Date(`${session.date}T${(session.time || "3:20").match(/\d{1,2}:\d{2}/)?.[0] || "3:20"}:00`)
        const withinOneDay = start.getTime() - Date.now() <= 24 * 60 * 60 * 1000 && start.getTime() - Date.now() > 0
        if (withinOneDay) {
          await sendSessionBookingReminderEmail({
            to: profile.email,
            memberName,
            sessionTitle: session.title || "session",
            sessionDate: session.date || "TBD",
            sessionTime: session.time || "TBD",
          })
        }
      }
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Booking route POST error:", error)
    return NextResponse.json({ error: "Unable to create booking" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const bookingId = typeof body?.booking_id === "string" ? body.booking_id : ""

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
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle()
    const canCancelAnyBooking = profile?.role === "staff" || profile?.role === "admin"

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (booking.session_id && !canCancelAnyBooking) {
      const { data: session } = await supabase
        .from("schedule")
        .select("id, date, time")
        .eq("id", booking.session_id)
        .maybeSingle()

      if (session) {
        const start = new Date(`${session.date}T${(session.time || "3:20").match(/\d{1,2}:\d{2}/)?.[0] || "3:20"}:00`)
        const cutoff = new Date(start.getTime() - 24 * 60 * 60 * 1000)
        if (new Date() >= cutoff) {
          return NextResponse.json({ error: "Cancellation is disabled within 24 hours of the session start. Please talk to the club leaders if you need help." }, { status: 409 })
        }
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Booking route DELETE error:", error)
    return NextResponse.json({ error: "Unable to cancel booking" }, { status: 500 })
  }
}
