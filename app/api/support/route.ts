import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    let query = supabase.from("support_tickets").select("*").order("created_at", { ascending: false })

    if (profile?.role !== "staff") {
      query = query.eq("user_id", user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error("Supabase fetch error:", error)
      return NextResponse.json(
        { error: `Failed to fetch support tickets: ${error.message}`, details: error },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error("GET /api/support error:", err)
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const subject = body?.subject?.trim()
    const message = body?.message?.trim()

    if (!subject || !message) {
      return NextResponse.json(
        { error: "Subject and message are required" },
        { status: 400 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Support profile lookup error:", profileError)
      return NextResponse.json(
        { error: `Profile lookup failed: ${profileError.message}`, details: profileError },
        { status: 500 },
      )
    }

    const payload = {
      user_id: user.id,
      user_email: profile?.email || user.email || "",
      subject,
      message,
      status: "open",
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .insert(payload)
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json(
        { error: `Failed to create support ticket: ${error.message}`, details: error },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: data?.[0] ? [data[0]] : [] })
  } catch (err) {
    console.error("POST /api/support error (caught):", err)
    console.error("POST /api/support error:", err)
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 },
    )
  }
}
