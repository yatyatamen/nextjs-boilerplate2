"use client"

import { useEffect, useMemo, useState } from "react"
import { Button, Card, Textarea, Badge } from "@/components/ui/primitives"
import type { Profile, SupportTicket } from "@/lib/types"
import { Loader2, MessageCircleMore, SendHorizontal, Trash2 } from "lucide-react"

type SupportReply = {
  id: string
  ticket_id: string
  sender_id: string
  message: string
  created_at: string
}

type SupportMessengerProps = {
  profile: Profile
  initialTickets?: SupportTicket[]
  isStaff?: boolean
}

function formatTime(value?: string | null) {
  if (!value) return "just now"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "just now"
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function SupportMessenger({ profile, initialTickets = [], isStaff = false }: SupportMessengerProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTickets[0]?.id ?? null)
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [replies, setReplies] = useState<Record<string, SupportReply[]>>({})
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [busyReplyId, setBusyReplyId] = useState<string | null>(null)

  const groupedThreads = useMemo(() => {
    const groups = new Map<string, { key: string; subject: string; tickets: SupportTicket[]; latestTicket: SupportTicket }>()

    for (const ticket of tickets) {
      const subject = (ticket.subject || "Support request").trim() || "Support request"
      const key = `${String(ticket.user_id || profile.id)}::${subject.toLowerCase()}`
      const existing = groups.get(key)

      if (existing) {
        existing.tickets.push(ticket)
        const currentTime = new Date(ticket.created_at).getTime()
        const latestTime = new Date(existing.latestTicket.created_at).getTime()
        if (Number.isFinite(currentTime) && (!Number.isFinite(latestTime) || currentTime > latestTime)) {
          existing.latestTicket = ticket
        }
      } else {
        groups.set(key, { key, subject, tickets: [ticket], latestTicket: ticket })
      }
    }

    return Array.from(groups.values()).sort((left, right) => {
      const leftTime = new Date(left.latestTicket.created_at).getTime()
      const rightTime = new Date(right.latestTicket.created_at).getTime()
      return rightTime - leftTime
    })
  }, [profile.id, tickets])

  const selectedTicket = useMemo(() => {
    const directMatch = tickets.find((ticket) => String(ticket.id) === String(selectedTicketId)) ?? null
    if (directMatch) return directMatch

    const groupedMatch = groupedThreads.find((thread) => String(thread.latestTicket.id) === String(selectedTicketId))
    return groupedMatch?.latestTicket ?? null
  }, [groupedThreads, selectedTicketId, tickets])

  const conversationMessages = useMemo(() => {
    if (!selectedTicket) return []

    const threadGroup = groupedThreads.find(
      (thread) => String(thread.latestTicket.id) === String(selectedTicketId),
    )

    const items: Array<{
      id: string
      kind: "ticket" | "reply"
      senderId: string
      message: string
      createdAt: string
    }> = []

    if (threadGroup) {
      for (const ticket of threadGroup.tickets) {
        items.push({
          id: `ticket-${ticket.id}`,
          kind: "ticket",
          senderId: ticket.user_id || "",
          message: ticket.message,
          createdAt: ticket.created_at,
        })

        const ticketReplies = replies[ticket.id] || []
        for (const reply of ticketReplies) {
          items.push({
            id: reply.id,
            kind: "reply",
            senderId: reply.sender_id,
            message: reply.message,
            createdAt: reply.created_at,
          })
        }
      }
    } else if (selectedTicket) {
      items.push({
        id: `ticket-${selectedTicket.id}`,
        kind: "ticket",
        senderId: selectedTicket.user_id || "",
        message: selectedTicket.message,
        createdAt: selectedTicket.created_at,
      })

      const ticketReplies = replies[selectedTicket.id] || []
      for (const reply of ticketReplies) {
        items.push({
          id: reply.id,
          kind: "reply",
          senderId: reply.sender_id,
          message: reply.message,
          createdAt: reply.created_at,
        })
      }
    }

    return items.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
  }, [groupedThreads, replies, selectedTicket, selectedTicketId])

  async function loadTickets() {
    setLoading(true)
    try {
      const res = await fetch("/api/support", { credentials: "same-origin" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Unable to load messages")
      const data = Array.isArray(json?.data) ? json.data : []
      setTickets(data)
      if (!selectedTicketId && data[0]) {
        setSelectedTicketId(String(data[0].id))
      }
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Unable to load messages" })
    } finally {
      setLoading(false)
    }
  }

  async function loadReplies(ticketId: string) {
    if (!ticketId) return
    try {
      const res = await fetch(`/api/support/reply?ticketId=${encodeURIComponent(ticketId)}`, { credentials: "same-origin" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Unable to load replies")
      const data = Array.isArray(json?.data) ? json.data : []
      setReplies((prev) => ({ ...prev, [ticketId]: data }))
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Unable to load replies" })
    }
  }

  useEffect(() => {
    void loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedTicketId) return
    if (selectedTicketId.startsWith("local-")) return

    const threadGroup = groupedThreads.find(
      (thread) => String(thread.latestTicket.id) === String(selectedTicketId),
    )

    if (threadGroup) {
      for (const ticket of threadGroup.tickets) {
        void loadReplies(String(ticket.id))
      }
    } else {
      void loadReplies(selectedTicketId)
    }
  }, [selectedTicketId, groupedThreads])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return

    setLoading(true)
    try {
      let res: Response
      let json: any

      if (isStaff && selectedTicket) {
        res = await fetch("/api/support/reply", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: selectedTicket.id, message: trimmed }),
        })
        json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "Unable to send reply")
        const newReply = {
          id: json?.data?.id || `reply-${Date.now()}`,
          ticket_id: selectedTicket.id,
          sender_id: profile.id,
          message: trimmed,
          created_at: new Date().toISOString(),
        }
        setReplies((prev) => ({ ...prev, [selectedTicket.id]: [...(prev[selectedTicket.id] || []), newReply] }))
        setStatus({ type: "success", message: "Reply sent" })
      } else {
        res = await fetch("/api/support", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: selectedTicket?.subject || "Support request", message: trimmed }),
        })
        json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "Unable to send message")
        const created = Array.isArray(json?.data) ? json.data[0] : json?.data
        if (created) {
          setTickets((prev) => [created, ...prev])
          setSelectedTicketId(String(created.id))
          setStatus({ type: "success", message: "Message sent" })
        }
      }
      setDraft("")
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Unable to send message" })
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteReply(replyId: string) {
    if (!selectedTicketId) return
    setBusyReplyId(replyId)
    try {
      const res = await fetch("/api/support/delete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: replyId, type: "reply" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Unable to delete reply")
      setReplies((prev) => ({ ...prev, [selectedTicketId]: (prev[selectedTicketId] || []).filter((entry) => entry.id !== replyId) }))
      setStatus({ type: "success", message: "Reply deleted" })
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Unable to delete reply" })
    } finally {
      setBusyReplyId(null)
    }
  }

  async function handleDeleteTicket(ticketId: string) {
    setBusyReplyId(ticketId)
    try {
      const res = await fetch("/api/support/delete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticketId, type: "ticket" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Unable to delete message")
      setTickets((prev) => {
        const nextTickets = prev.filter((entry) => String(entry.id) !== String(ticketId))
        if (selectedTicketId === ticketId) {
          const nextTicket = nextTickets[0]
          setSelectedTicketId(nextTicket ? String(nextTicket.id) : null)
        }
        return nextTickets
      })
      setReplies((prev) => {
        const next = { ...prev }
        delete next[ticketId]
        return next
      })
      setStatus({ type: "success", message: "Message deleted" })
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Unable to delete message" })
    } finally {
      setBusyReplyId(null)
    }
  }

  return (
    <div className="grid h-full min-h-[520px] grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="flex h-full flex-col overflow-hidden border-zinc-800 bg-zinc-950/80 p-0">
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <MessageCircleMore className="h-4 w-4 text-[#E2AC28]" />
            <h3 className="text-sm font-semibold text-white">{isStaff ? "Support inbox" : "Your messages"}</h3>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Messages are stored in the club support system and can be deleted anytime.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {groupedThreads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-400">
              No messages yet. Start a new conversation below.
            </div>
          ) : (
            <div className="space-y-2">
              {groupedThreads.map((thread) => {
                const isActive = String(thread.latestTicket.id) === String(selectedTicketId)
                return (
                  <button
                    key={thread.key}
                    type="button"
                    onClick={() => setSelectedTicketId(String(thread.latestTicket.id))}
                    className={`w-full rounded-xl border p-3 text-left transition ${isActive ? "border-[#E2AC28] bg-zinc-900" : "border-zinc-800 bg-zinc-950/70 hover:bg-zinc-900"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{thread.subject || "Support request"}</p>
                        <p className="mt-1 text-xs text-zinc-500">{thread.latestTicket.message}</p>
                      </div>
                      <Badge variant={thread.latestTicket.status === "resolved" ? "accent" : "default"}>{thread.latestTicket.status || "open"}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-zinc-500">{thread.tickets.length > 1 ? `${thread.tickets.length} messages in this chat` : "Single message"}</p>
                      <p className="text-[11px] text-zinc-500">{formatTime(thread.latestTicket.created_at)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="flex h-full flex-col overflow-hidden border-zinc-800 bg-zinc-950/80 p-0">
        {selectedTicket ? (
          <>
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedTicket.subject || "Support request"}</h3>
                <p className="text-xs text-zinc-500">{selectedTicket.user_email || profile.email}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-zinc-400 hover:text-red-400"
                onClick={() => handleDeleteTicket(selectedTicket.id)}
                disabled={busyReplyId === selectedTicket.id}
              >
                {busyReplyId === selectedTicket.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(226,172,40,0.08),_transparent_50%)] p-4 space-y-3">
              {conversationMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-zinc-500">No messages yet. Start the conversation below.</p>
                </div>
              ) : (
                conversationMessages.map((entry) => {
                  const isOutgoing = entry.kind === "ticket" ? !isStaff : entry.senderId === profile.id
                  return (
                    <div key={entry.id} className={`flex ${isOutgoing ? "justify-end" : "justify-start"} gap-2`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isOutgoing ? "rounded-br-none border border-[#E2AC28]/40 bg-[#E2AC28] text-zinc-900" : "rounded-bl-none border border-zinc-700 bg-zinc-900 text-zinc-100"}`}>
                        <p className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${isOutgoing ? "text-zinc-800/70" : "text-zinc-400"}`}>
                          {isOutgoing ? "You" : isStaff ? "Member" : "Staff"}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.message}</p>
                        <p className={`mt-1 text-[10px] ${isOutgoing ? "text-zinc-800/60" : "text-zinc-500"}`}>{formatTime(entry.createdAt)}</p>
                        {entry.kind === "reply" && isStaff && (
                          <button type="button" onClick={() => handleDeleteReply(entry.id)} className={`mt-1 text-[10px] font-semibold ${isOutgoing ? "text-zinc-800/50 hover:text-zinc-800" : "text-zinc-500 hover:text-red-400"}`}>
                            {busyReplyId === entry.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950/80 p-4">
              {status && (
                <p className={`mb-3 text-sm ${status.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{status.message}</p>
              )}
              <form onSubmit={handleSend} className="flex flex-col gap-2">
                <Textarea
                  rows={3}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={isStaff ? "Write a reply to the member" : "Write a new support message"}
                  className="border-zinc-800 bg-zinc-900"
                />
                <div className="flex items-center justify-end">
                  <Button type="submit" size="sm" className="bg-[#E2AC28] text-black" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  </Button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-400">
            Select a message to view it.
          </div>
        )}
      </Card>
    </div>
  )
}
