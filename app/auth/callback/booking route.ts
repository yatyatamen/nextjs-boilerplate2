import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"

function coerceValue(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
    return trimmed
  }
  return undefined
}

async function parseJsonBody(request: NextRequest, fallback: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
      return fallback
    }

    const text = await request.text()
    if (!text.trim()) {
      return fallback
    }

    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return fallback
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request, {})
    const sessionIdValue = coerceValue(body?.session_id)

    if (sessionIdValue === undefined) return NextResponse.json({ error: "session_id required" }, { status: 400 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Booking service unavailable" }, { status: 503 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const user = userData.user

    const { data, error } = await supabase
      .from("bookings")
      .insert({ session_id: sessionIdValue, user_id: user.id, status: "confirmed" })
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
    const body = await parseJsonBody(request, {})
    const rawBookingId = body?.booking_id ?? request.nextUrl.searchParams.get("booking_id")
    const rawSessionId = body?.session_id ?? request.nextUrl.searchParams.get("session_id")
    const bookingIdCandidates: Array<string | number> = []
    const primaryBookingId = coerceValue(rawBookingId)
    const sessionIdValue = coerceValue(rawSessionId)

    if (primaryBookingId !== undefined) {
      bookingIdCandidates.push(primaryBookingId)
      if (typeof primaryBookingId === "number") {
        bookingIdCandidates.push(String(primaryBookingId))
      } else if (/^-?\d+$/.test(primaryBookingId)) {
        bookingIdCandidates.push(Number(primaryBookingId))
      }
    }

    if (bookingIdCandidates.length === 0) {
      return NextResponse.json({ error: "booking_id required" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    const user = userData.user

    // fetch booking to verify ownership
    let existing: Record<string, unknown> | null = null
    let fetchError: unknown = null

    for (const candidate of bookingIdCandidates) {
      const { data, error } = await supabase.from("bookings").select("*").eq("id", candidate as never).maybeSingle()
      if (!error && data) {
        existing = data
        fetchError = null
        break
      }
      fetchError = error
    }

    if (!existing && sessionIdValue !== undefined && user.id) {
      const { data: sessionBooking, error: sessionError } = await supabase
        .from("bookings")
        .select("*")
        .eq("session_id", sessionIdValue as never)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!sessionError && sessionBooking) {
        existing = sessionBooking
      }
    }

    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // check actor role or ownership
    const { data: actorProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const isStaff = actorProfile?.role === "staff"

    if (!isStaff && existing.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this booking" }, { status: 403 })
    }

    const { data, error } = await supabase.from("bookings").delete().eq("id", (existing as Record<string, unknown>).id as never).select()
    if (error) {
      console.error("Booking delete failed:", error)
      return NextResponse.json({ error: error.message || "Unable to delete booking" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("Booking route DELETE error:", err)
    return NextResponse.json({ error: "Unable to delete booking" }, { status: 500 })
  }
}
