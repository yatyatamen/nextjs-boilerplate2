import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return "Unable to post schedule session"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body?.date !== "string" || !body.date.trim() || typeof body?.time !== "string" || !body.time.trim()) {
      return NextResponse.json({ error: "A session date and time are required" }, { status: 400 })
    }

    const capacity = body.max_capacity == null || body.max_capacity === ""
      ? null
      : Number(body.max_capacity)
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      return NextResponse.json({ error: "Capacity must be a positive whole number" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single()
    const role = String(profile?.role ?? "").trim().toLowerCase()
    if (profileError || !["staff", "leader", "admin"].includes(role)) {
      return NextResponse.json({ error: "Schedule access denied" }, { status: 403 })
    }

    let database = supabase
    try {
      database = await createServiceClient()
    } catch {
      // Use the authenticated client when the service role is unavailable.
    }
    const { data, error } = await database
      .from("schedule")
      .insert({
        date: body.date.trim(),
        time: body.time.trim(),
        max_level: typeof body.max_level === "string"
          ? body.max_level
          : typeof body.level === "string" ? body.level : null,
        max_capacity: capacity,
        visibility_tiers: Array.isArray(body.visibility_tiers) ? body.visibility_tiers : [],
        coach: typeof body.coach === "string" ? body.coach : null,
        title: typeof body.title === "string" ? body.title : "Training Session",
        notes: typeof body.notes === "string" ? body.notes : null,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Schedule create failed:", error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}