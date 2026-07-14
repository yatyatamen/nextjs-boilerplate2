import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { sendSupportEmail } from "@/lib/email"
import { getTicketById, updateTicketMessage } from "@/lib/support-store"

function formatThreadMessage(senderRole: "member" | "staff", message: string) {
  return `[${senderRole}] ${message.trim()}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get("ticketId")
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId required" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    let data: { id: string; message: string } | null = null
    try {
      const result = await supabase
        .from("support_tickets")
        .select("id, message")
        .eq("id", ticketId)
        .single()
      data = result.data as { id: string; message: string } | null
    } catch {
      data = null
    }

    if (!data) {
      const fallbackTicket = getTicketById(ticketId)
      if (!fallbackTicket) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 })
      }
      data = { id: fallbackTicket.id, message: fallbackTicket.message }
    }

    const parsedMessages = (data.message || "")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\[(member|staff)\]\s*(.+)$/i)
        return match
          ? { role: match[1].toLowerCase(), content: match[2].trim() }
          : { role: "member", content: line.trim() }
      })

    return NextResponse.json({ data: parsedMessages })
  } catch (error) {
    return NextResponse.json({ error: "Unable to load replies" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId : ""
    const message = typeof body?.message === "string" ? body.message : ""

    if (!ticketId || !message.trim()) {
      return NextResponse.json({ error: "ticketId and message are required" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    let ticketData: { id: string; user_email: string; message: string } | null = null
    try {
      const result = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .single()
      ticketData = result.data as { id: string; user_email: string; message: string } | null
    } catch {
      ticketData = null
    }

    if (!ticketData) {
      const fallbackTicket = getTicketById(ticketId)
      if (!fallbackTicket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
      }
      ticketData = { id: fallbackTicket.id, user_email: fallbackTicket.user_email, message: fallbackTicket.message }
    }

    const combinedMessage = [ticketData.message, formatThreadMessage("staff", message)]
      .filter(Boolean)
      .join("\n")

    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .update({ message: combinedMessage, status: "open" })
        .eq("id", ticketId)
        .select()
        .single()

      if (!error && data) {
        if (ticketData.user_email) {
          const emailResult = await sendSupportEmail({
            to: ticketData.user_email,
            subject: `[Wolves] Reply to your message`,
            message: `A club staff member replied:\n\n${message}`,
          })

          if (!emailResult.ok) {
            console.warn("Reply email send failed", emailResult.error)
          }
        }

        return NextResponse.json({ data: { message, role: "staff" } })
      }
    } catch {
      // fall through to fallback below
    }

    const updatedTicket = updateTicketMessage({ ticketId, message: combinedMessage, status: "open" })
    if (updatedTicket) {
      if (ticketData.user_email) {
        const emailResult = await sendSupportEmail({
          to: ticketData.user_email,
          subject: `[Wolves] Reply to your message`,
          message: `A club staff member replied:\n\n${message}`,
        })

        if (!emailResult.ok) {
          console.warn("Reply email send failed", emailResult.error)
        }
      }

      return NextResponse.json({ data: { message, role: "staff" } })
    }

    return NextResponse.json({ error: "Unable to save reply" }, { status: 500 })
  } catch (error) {
    console.error("Support reply route POST error", error)
    return NextResponse.json({ error: "Unable to send reply" }, { status: 500 })
  }
}
