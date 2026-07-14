import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const session_id = typeof body?.session_id === "string" || typeof body?.session_id === "number" ? String(body.session_id) : ""

    if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 })

    const supabase = await createSupabaseServerClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const user = userData.user

    const { data, error } = await supabase
      .from("bookings")
      .insert({ session_id: session_id, user_id: user.id, status: "confirmed" })
      .select()

    if (error) {
      console.error("Booking create failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("Booking route POST error:", err)
    return NextResponse.json({ error: "Unable to create booking" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const booking_id = typeof body?.booking_id === "string" || typeof body?.booking_id === "number" ? String(body.booking_id) : ""
    if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 })

    const supabase = await createSupabaseServerClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    const user = userData.user

    // fetch booking to verify ownership
    const { data: existing, error: fetchError } = await supabase.from("bookings").select("*").eq("id", booking_id).single()
    if (fetchError || !existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // check actor role or ownership
    const { data: actorProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const isStaff = actorProfile?.role === "staff"

    if (!isStaff && existing.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this booking" }, { status: 403 })
    }

    const { data, error } = await supabase.from("bookings").delete().eq("id", booking_id).select()
    if (error) {
      console.error("Booking delete failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("Booking route DELETE error:", err)
    return NextResponse.json({ error: "Unable to delete booking" }, { status: 500 })
  }
}
