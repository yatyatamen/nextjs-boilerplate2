import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createTicket } from "@/lib/support-store"

export async function GET(request: NextRequest) {
  try {
    const ticketId = request.nextUrl.searchParams.get("ticketId")
    if (!ticketId) {
      return NextResponse.json({ data: [] })
    }

    let supabase = null
    try {
      supabase = await createClient()
    } catch (err) {
      console.warn("Reply GET: Supabase unavailable", err)
    }

    if (!supabase) {
      return NextResponse.json({ data: [] })
    }

    const { data, error } = await supabase.from("support_tickets").select("*").eq("id", ticketId).maybeSingle()
    if (error) {
      console.error("Reply GET error:", error)
      return NextResponse.json({ data: [] })
    }

    return NextResponse.json({ data: data ? [data] : [] })
  } catch (err) {
    console.error("Reply GET failed:", err)
    return NextResponse.json({ data: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const ticketId = body?.ticketId ?? body?.ticket_id
    const message = typeof body?.message === "string" ? body.message.trim() : ""

    if (!ticketId || !message) {
      return NextResponse.json({ error: "Ticket id and message are required" }, { status: 400 })
    }

    let supabase = null
    try {
      supabase = await createClient()
    } catch (err) {
      console.warn("Reply POST: Supabase unavailable", err)
    }

    if (!supabase) {
      const fallback = createTicket({ userId: `local-${Date.now()}`, userEmail: "", subject: "Staff reply", message })
      return NextResponse.json({ data: fallback })
    }

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    const { data: originalTicket, error: loadError } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle()

    if (loadError || !originalTicket) {
      console.error("Reply POST lookup failed:", loadError)
      return NextResponse.json({ error: "Original ticket not found" }, { status: 404 })
    }

    const payload = {
      user_id: originalTicket.user_id ?? user?.id ?? null,
      user_email: originalTicket.user_email ?? user?.email ?? null,
      subject: originalTicket.subject ?? "Member message",
      message,
      status: "open",
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("support_tickets").insert(payload).select()
    if (error || !data) {
      console.error("Reply POST insert failed:", error)
      return NextResponse.json({ error: error?.message ?? "Unable to save reply" }, { status: 500 })
    }

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data })
  } catch (err) {
    console.error("Reply POST failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ data: { deleted: 0 } })
}
