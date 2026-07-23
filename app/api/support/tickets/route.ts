import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
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

    if (profile?.role !== "staff") {
      return NextResponse.json({ error: "Only staff can access this endpoint" }, { status: 403 })
    }

    let client = supabase

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      client = await createServiceClient()
    }

    const { data, error } = await client
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Support tickets fetch error:", error)
      return NextResponse.json(
        { error: `Failed to fetch support tickets: ${error.message}`, details: error },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error("GET /api/support/tickets error:", err)
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 },
    )
  }
}
