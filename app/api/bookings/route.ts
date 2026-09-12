import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

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

    const database = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
      ? await createServiceClient()
      : supabase

    const { error } = await database
      .from("bookings")
      .delete()
      .eq("id", bookingId)
      .eq("user_id", userData.user.id)

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
