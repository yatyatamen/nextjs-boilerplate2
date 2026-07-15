import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "../../../../lib/supabase/server"
import { sendSupportEmail } from "../../../../lib/supabase/email"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId : undefined
    const message = typeof body?.message === "string" ? body.message.trim() : ""

    if (!ticketId || !message) {
      return NextResponse.json({ error: "ticketId and message are required" }, { status: 400 })
    }

    let authorId: string | null = null
    let authorEmail: string | null = null
    let ticketOwnerEmail: string | null = null

    try {
      const supabase = await createSupabaseServerClient()
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (!userErr && userData?.user) {
        authorId = userData.user.id
        authorEmail = userData.user.email ?? null
      }

      const ticketResult = await supabase
        .from("support_tickets")
        .select("user_email")
        .eq("id", ticketId)
        .single()

      if (!ticketResult.error && ticketResult.data) {
        ticketOwnerEmail = ticketResult.data.user_email
      }
    } catch (err) {
      console.warn("Support reply auth or ticket lookup failed:", err)
    }

    const payload = {
      ticket_id: ticketId,
      message,
      user_id: authorId,
      created_at: new Date().toISOString(),
    }

    try {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase.from("support_replies").insert(payload).select()
      if (!error && data) {
        const reply = data[0]

        if (ticketOwnerEmail) {
          await sendSupportEmail({
            to: ticketOwnerEmail,
            subject: `New reply to your club support message`,
            message: `A club staff member replied to your support thread:\n\n${message}\n\nPlease sign in to the site to view the full conversation and reply.`,
          })
        }

        return NextResponse.json({ data: reply })
      }

      console.warn("Support reply insert failed:", error)
    } catch (dbErr) {
      console.warn("Support reply insert threw:", dbErr)
    }

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
