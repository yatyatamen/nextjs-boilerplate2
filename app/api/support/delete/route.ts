import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const id = body?.id
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const serviceClient = await createServiceClient()

    // Try delete from replies first
    const { error: replyErr } = await serviceClient.from("support_replies").delete().eq("id", id)
    if (!replyErr) {
      return NextResponse.json({ data: { deleted: true, table: "support_replies" } })
    }

    // Fallback to tickets
    const { error: ticketErr } = await serviceClient.from("support_tickets").delete().eq("id", id)
    if (!ticketErr) {
      return NextResponse.json({ data: { deleted: true, table: "support_tickets" } })
    }

    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  } catch (err) {
    console.error("/api/support/delete error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
