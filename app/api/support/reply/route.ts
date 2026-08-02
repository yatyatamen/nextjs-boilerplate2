import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { createReply, listRepliesForTicket } from "@/lib/support-store"

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))

  try {
    const ticketId = body?.ticketId?.toString()
    const message = body?.message?.trim()

    if (!ticketId || !message) {
      return NextResponse.json({ error: "Ticket ID and message are required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      const reply = createReply({ ticketId, senderId: body?.senderId || "local-staff", message })
      return NextResponse.json({ data: { id: reply.id, message: reply.message, ticketId } })
    }

    let authUserId = body?.senderId?.toString() || "local-staff"

    try {
      const authClient = await createClient()
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser()

      if (!authError && user) {
        authUserId = user.id

        const { data: profile, error: profileError } = await authClient
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError) {
          throw profileError
        }

        if (profile?.role !== "staff") {
          const reply = createReply({ ticketId, senderId: user.id, message })
          return NextResponse.json({ data: { id: reply.id, message: reply.message, ticketId } })
        }

        const insertClient = process.env.SUPABASE_SERVICE_ROLE_KEY
          ? await createServiceClient()
          : await createClient()

        const { error: replyError } = await insertClient
          .from("support_replies")
          .insert({ ticket_id: ticketId, sender_id: user.id, message, created_at: new Date().toISOString() })

        if (!replyError) {
          const { error: ticketError } = await insertClient.from("support_tickets").update({ status: "open" }).eq("id", ticketId)
          if (ticketError) {
            console.error("Reply ticket update error:", ticketError)
          }
        }

        if (replyError) {
          throw replyError
        }

        return NextResponse.json({ data: { message, ticketId } })
      }
    } catch (error) {
      console.error("Reply insert fallback triggered:", error)
    }

    const fallbackReply = createReply({ ticketId, senderId: authUserId, message })
    return NextResponse.json({ data: { id: fallbackReply.id, message: fallbackReply.message, ticketId } })
  } catch (err) {
    console.error("POST /api/support/reply error:", err)
    const fallbackReply = createReply({
      ticketId: body?.ticketId?.toString() || "",
      senderId: body?.senderId || "local-staff",
      message: body?.message?.trim() || "",
    })
    return NextResponse.json({ data: { id: fallbackReply.id, message: fallbackReply.message, ticketId: body?.ticketId?.toString() || "" } })
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      const { searchParams } = new URL(request.url)
      const ticketId = searchParams.get("ticketId")
      if (!ticketId) {
        return NextResponse.json({ error: "Ticket ID is required" }, { status: 400 })
      }
      return NextResponse.json({ data: listRepliesForTicket(ticketId) })
    }

    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? await createServiceClient()
      : await createClient()

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get("ticketId")

    if (!ticketId) {
      console.error("GET /api/support/reply: No ticketId provided")
      return NextResponse.json({ error: "Ticket ID is required" }, { status: 400 })
    }

    console.log(`GET /api/support/reply: Fetching replies for ticketId=${ticketId}`)

    const { data: replies, error: repliesError } = await supabase
      .from("support_replies")
      .select("id, ticket_id, sender_id, message, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })

    if (repliesError) {
      console.error(`GET /api/support/reply: Error fetching replies:`, repliesError)
      return NextResponse.json({ data: listRepliesForTicket(ticketId) })
    }

    console.log(`GET /api/support/reply: Returning ${replies?.length ?? 0} replies`)
    return NextResponse.json({ data: replies || [] })
  } catch (err) {
    console.error("GET /api/support/reply error:", err)
    return NextResponse.json({ data: [] })
  }
}
