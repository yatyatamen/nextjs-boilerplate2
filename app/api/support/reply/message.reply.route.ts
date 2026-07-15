import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId : undefined
    const message = typeof body?.message === "string" ? body.message.trim() : ""

    if (!ticketId || !message) {
      return NextResponse.json({ error: "ticketId and message are required" }, { status: 400 })
    }

    try {
      const supabase = await createSupabaseServerClient()
      // Attempt to associate reply with authenticated user if available
      let authorId: string | null = null
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser()
        if (!userErr && userData?.user) authorId = userData.user.id
      } catch (err) {
        // ignore
      }

      const payload = {
        ticket_id: ticketId,
        message,
        user_id: authorId,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from("support_replies").insert(payload).select()
      if (!error && data) {
        return NextResponse.json({ data: data[0] })
      }
      console.warn("Support reply insert failed:", error)
    } catch (dbErr) {
      console.warn("Support reply insert threw:", dbErr)
    }

    // Fallback: return the message without persisting
    return NextResponse.json({ data: { message, ticketId, fallback: true } })
  } catch (err) {
    console.error("Support reply POST error:", err)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const ticketId = url.searchParams.get("ticketId")
    if (!ticketId) return NextResponse.json({ data: [] })

    try {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase
        .from("support_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })

      if (!error && data) return NextResponse.json({ data })
      console.warn("Support reply fetch failed:", error)
    } catch (dbErr) {
      console.warn("Support reply fetch threw:", dbErr)
    }

    return NextResponse.json({ data: [] })
  } catch (err) {
    console.error("Support reply GET error:", err)
    return NextResponse.json({ data: [] })
  }
}
