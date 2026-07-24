import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { listAllTickets } from "@/lib/support-store"

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ data: listAllTickets() })
    }

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
      return NextResponse.json({ data: listAllTickets() })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error("GET /api/support/tickets error:", err)
    return NextResponse.json({ data: listAllTickets() })
  }
}
