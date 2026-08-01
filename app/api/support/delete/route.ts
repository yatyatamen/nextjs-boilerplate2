import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { deleteReply, deleteRepliesForTicket, deleteTicket } from "@/lib/support-store"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const id = body?.id?.toString()
    const type = body?.type?.toString() || "reply"
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    let client: Awaited<ReturnType<typeof createClient>> | Awaited<ReturnType<typeof createServiceClient>> | null = null

    try {
      client = await createServiceClient()
    } catch {
      try {
        client = await createClient()
      } catch {
        client = null
      }
    }

    if (client) {
      if (type === "reply") {
        const { error: replyErr } = await client.from("support_replies").delete().eq("id", id)
        if (!replyErr) {
          deleteReply(id)
          return NextResponse.json({ data: { deleted: true, table: "support_replies" } })
        }
      }

      if (type === "ticket") {
        const { error: replyErr } = await client.from("support_replies").delete().eq("ticket_id", id)
        const { error: ticketErr } = await client.from("support_tickets").delete().eq("id", id)
        if (!ticketErr) {
          deleteRepliesForTicket(id)
          deleteTicket(id)
          return NextResponse.json({ data: { deleted: true, table: "support_tickets" } })
        }
        console.error("Ticket delete error:", replyErr || ticketErr)
      }
    }

    if (type === "reply") {
      deleteReply(id)
      return NextResponse.json({ data: { deleted: true, table: "support_replies", fallback: true } })
    }

    deleteRepliesForTicket(id)
    deleteTicket(id)
    return NextResponse.json({ data: { deleted: true, table: "support_tickets", fallback: true } })
  } catch (err) {
    console.error("/api/support/delete error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
