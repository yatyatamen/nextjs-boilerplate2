"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button, Card, Textarea, Badge } from "@/components/ui/primitives"
import type { Profile, SupportTicket } from "@/lib/types"
import { ImagePlus, Loader2, MessageCircleMore, SendHorizontal } from "lucide-react"

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
  onTicketsChange?: (tickets: SupportTicket[]) => void
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

function formatPreviewMessage(value?: string | null) {
  const normalized = (value || "").replace(/\s+/g, " ").trim()
  if (!normalized) return "No messages yet"
  return normalized.length > 70 ? `${normalized.slice(0, 67)}...` : normalized
}

async function parseJsonResponse(res: Response) {
  const text = await res.text().catch(() => "")
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

function parseMessageContent(message: string) {
  const trimmed = message.trim()
  const imageMatch = trimmed.match(/^__IMAGE__:(https?:\/\/\S+)(?:\s*(.*))?$/)

  if (imageMatch) {
    return {
      imageUrl: imageMatch[1],
      caption: imageMatch[2]?.trim() || "",
    }
  }

  return {
    imageUrl: null as string | null,
    caption: "",
  }
}

export function SupportMessenger({ profile, initialTickets = [], isStaff = false, onTicketsChange }: SupportMessengerProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTickets[0]?.id ?? null)
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [replies, setReplies] = useState<Record<string, SupportReply[]>>({})
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [pendingImageName, setPendingImageName] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [readThreads, setReadThreads] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {}

    try {
      const stored = window.localStorage.getItem(`support-messenger-read:${profile.id}:${isStaff ? "staff" : "member"}`)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const lastSelectedTicketIdRef = useRef<string | null>(selectedTicketId)

  const storageKey = `support-messenger-read:${profile.id}:${isStaff ? "staff" : "member"}`

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

    return Array.from(groups.values())
      .map((thread) => {
        const entries = thread.tickets.flatMap((ticket) => {
          const ticketEntry = { id: `ticket-${ticket.id}`, createdAt: ticket.created_at, message: ticket.message }
          const repliesForTicket = (replies[ticket.id] || []).map((reply) => ({
            id: reply.id,
            createdAt: reply.created_at,
            message: reply.message,
          }))
          return [ticketEntry, ...repliesForTicket]
        })

        entries.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
        const latestEntry = entries[entries.length - 1]
        const latestMessageTime = latestEntry?.createdAt || thread.latestTicket.created_at
        const latestMessageText = formatPreviewMessage(latestEntry?.message || thread.latestTicket.message)
        const latestActivityAt = new Date(latestMessageTime).getTime()

        return {
          ...thread,
          latestMessageText,
          latestMessageTime,
          latestActivityAt,
        }
      })
      .sort((left, right) => right.latestActivityAt - left.latestActivityAt)
  }, [profile.id, replies, tickets])

  const selectedTicket = useMemo(() => {
    const directMatch = tickets.find((ticket) => String(ticket.id) === String(selectedTicketId)) ?? null
    if (directMatch) return directMatch

    const groupedMatch = groupedThreads.find((thread) => String(thread.latestTicket.id) === String(selectedTicketId))
    return groupedMatch?.latestTicket ?? null
  }, [groupedThreads, selectedTicketId, tickets])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(storageKey, JSON.stringify(readThreads))
  }, [readThreads, storageKey])

  useEffect(() => {
    if (!selectedTicketId) return
    const ticketId = String(selectedTicketId)
    setReadThreads((prev) => ({ ...prev, [ticketId]: new Date().toISOString() }))
    shouldAutoScrollRef.current = true
  }, [selectedTicketId])

  const conversationMessages = useMemo(() => {
    if (!selectedTicket) return []

    // Try to find the exact thread group
    let threadGroup = groupedThreads.find(
      (thread) => String(thread.latestTicket.id) === String(selectedTicketId),
    )

    // Fallback: if not found, reconstruct by matching subject and user
    if (!threadGroup) {
      const matchingTickets = tickets.filter(
        (ticket) =>
          (ticket.subject || "Support request").toLowerCase() ===
            (selectedTicket.subject || "Support request").toLowerCase() &&
          String(ticket.user_id || profile.id) === String(selectedTicket.user_id || profile.id),
      )
      if (matchingTickets.length > 0) {
        threadGroup = {
          key: "",
          subject: selectedTicket.subject || "Support request",
          tickets: matchingTickets,
          latestTicket: selectedTicket,
          latestMessageText: formatPreviewMessage(selectedTicket.message),
          latestMessageTime: selectedTicket.created_at,
          latestActivityAt: new Date(selectedTicket.created_at).getTime(),
        }
      }
    }

    const items: Array<{
      id: string
      kind: "ticket" | "reply"
      senderId: string
      message: string
      createdAt: string
    }> = []

    if (threadGroup?.tickets && threadGroup.tickets.length > 0) {
      // Sort tickets by created_at chronologically
      const sortedTickets = [...threadGroup.tickets].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )

      for (const ticket of sortedTickets) {
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
    } else {
      // Fallback for single ticket
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
  }, [groupedThreads, profile.id, replies, selectedTicket, selectedTicketId, tickets])

  async function loadTickets() {
    setLoading(true)
    try {
      const res = await fetch("/api/support", { credentials: "same-origin" })
      const json = await parseJsonResponse(res)
      if (!res.ok) throw new Error(json?.error || "Unable to load messages")
      const data = Array.isArray(json?.data) ? json.data : []
      setTickets(data)
      onTicketsChange?.(data)
      if (!selectedTicketId && data[0]) {
        setSelectedTicketId(String(data[0].id))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load messages"
      if (tickets.length === 0 && initialTickets.length === 0) {
        setStatus({ type: "error", message })
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadReplies(ticketId: string) {
    if (!ticketId) return
    try {
      const res = await fetch(`/api/support/reply?ticketId=${encodeURIComponent(ticketId)}`, { credentials: "same-origin" })
      const json = await parseJsonResponse(res)
      if (!res.ok) throw new Error(json?.error || "Unable to load replies")
      const data = Array.isArray(json?.data) ? json.data : []
      setReplies((prev) => ({ ...prev, [ticketId]: data }))
    } catch (error) {
      console.error("Failed to load replies:", error)
      // Avoid showing stale reply-loading errors in the send bar while the user is composing.
    }
  }

  useEffect(() => {
    void loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setTickets(initialTickets)

    if (!initialTickets.some((ticket) => String(ticket.id) === String(selectedTicketId))) {
      const fallbackTicket = initialTickets[0]
      setSelectedTicketId(fallbackTicket ? String(fallbackTicket.id) : null)
    }
  }, [initialTickets, selectedTicketId])

  useEffect(() => {
    if (!messagesContainerRef.current) return

    const container = messagesContainerRef.current
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 20

    if (selectedTicketId !== lastSelectedTicketIdRef.current) {
      shouldAutoScrollRef.current = true
      lastSelectedTicketIdRef.current = selectedTicketId
    }

    if (shouldAutoScrollRef.current || isAtBottom) {
      const frame = window.requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
        }
      })
      return () => window.cancelAnimationFrame(frame)
    }

    return undefined
  }, [conversationMessages, selectedTicketId])

  useEffect(() => {
    if (!selectedTicketId) return
    if (selectedTicketId.startsWith("local-")) return

    const threadGroup = groupedThreads.find(
      (thread) => String(thread.latestTicket.id) === String(selectedTicketId),
    )

    if (threadGroup && threadGroup.tickets.length > 0) {
      // Load replies for all tickets in the thread group
      for (const ticket of threadGroup.tickets) {
        void loadReplies(String(ticket.id))
      }
    } else if (selectedTicketId) {
      // Fallback: load replies for just this ticket
      void loadReplies(selectedTicketId)
    }
  }, [selectedTicketId, groupedThreads])

  async function handleImageSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: "Please choose an image file" })
      if (imageInputRef.current) imageInputRef.current.value = ""
      return
    }

    setIsUploadingImage(true)
    setStatus(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/support/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      })
      const json = await parseJsonResponse(res)
      if (!res.ok || !json?.data?.publicUrl) throw new Error(json?.error || "Unable to upload image")

      setPendingImageUrl(String(json.data.publicUrl))
      setPendingImageName(file.name)
      setStatus({ type: "success", message: `Image ready: ${file.name}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload image"
      setStatus({ type: "error", message })
    } finally {
      setIsUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ""
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    const trimmed = draft.trim()
    const hasImageAttachment = Boolean(pendingImageUrl)
    if (!trimmed && !hasImageAttachment) return

    if (!selectedTicket) {
      setStatus({ type: "error", message: "Select a conversation before sending" })
      return
    }

    const payloadMessage = hasImageAttachment
      ? `${trimmed ? `${trimmed}\n` : ""}__IMAGE__:${pendingImageUrl}`
      : trimmed

    setLoading(true)

    try {
      let res: Response | null = null
      let json: any = {}

      if (isStaff) {
        res = await fetch("/api/support/reply", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: selectedTicket.id, message: payloadMessage }),
        })
        json = await parseJsonResponse(res)
        if (!res.ok) throw new Error(json?.error || "Unable to send reply")
        const newReply = {
          id: json?.data?.id || `reply-${Date.now()}`,
          ticket_id: selectedTicket.id,
          sender_id: profile.id,
          message: payloadMessage,
          created_at: new Date().toISOString(),
        }
        setReplies((prev) => ({ ...prev, [selectedTicket.id]: [...(prev[selectedTicket.id] || []), newReply] }))
        setStatus({ type: "success", message: hasImageAttachment ? "Image sent" : "Reply sent" })
      } else {
        res = await fetch("/api/support", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: selectedTicket.subject || "Support request", message: payloadMessage }),
        })
        json = await parseJsonResponse(res)
        if (!res.ok) throw new Error(json?.error || "Unable to send message")
        const created = Array.isArray(json?.data) ? json.data[0] : json?.data
        if (created) {
          setTickets((prev) => {
            const next = [created, ...prev]
            onTicketsChange?.(next)
            return next
          })
          setSelectedTicketId(String(created.id))
          setStatus({ type: "success", message: hasImageAttachment ? "Image sent" : "Message sent" })
        }
      }
      setDraft("")
      setPendingImageUrl(null)
      setPendingImageName(null)
    } catch (error) {
      const fallback = {
        id: `local-${Date.now()}`,
        user_id: profile.id,
        user_email: profile.email || "",
        subject: selectedTicket.subject || "Support request",
        message: payloadMessage,
        status: "open" as const,
        created_at: new Date().toISOString(),
      }

      if (isStaff) {
        const fallbackReply = {
          id: `reply-${Date.now()}`,
          ticket_id: selectedTicket.id,
          sender_id: profile.id,
          message: payloadMessage,
          created_at: new Date().toISOString(),
        }
        setReplies((prev) => ({ ...prev, [selectedTicket.id]: [...(prev[selectedTicket.id] || []), fallbackReply] }))
        setStatus({ type: "success", message: "Reply saved locally and will sync when connection is restored" })
      } else {
        setTickets((prev) => {
          const next = [fallback, ...prev]
          onTicketsChange?.(next)
          return next
        })
        setSelectedTicketId(String(fallback.id))
        setStatus({ type: "success", message: "Message saved locally and will sync when connection is restored" })
      }
      setDraft("")
      setPendingImageUrl(null)
      setPendingImageName(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteSelectedTicket() {
    if (!selectedTicket) return

    const ticketId = String(selectedTicket.id)

    if (ticketId.startsWith("local-")) {
      setTickets((prev) => prev.filter((ticket) => String(ticket.id) !== ticketId))
      onTicketsChange?.(tickets.filter((ticket) => String(ticket.id) !== ticketId))
      setSelectedTicketId((prev) => {
        const next = tickets.filter((ticket) => String(ticket.id) !== ticketId)
        return next[0] ? String(next[0].id) : null
      })
      setStatus({ type: "success", message: "Local message removed" })
      return
    }

    try {
      const res = await fetch("/api/support/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticketId, type: "ticket" }),
      })
      if (!res.ok) {
        const json = await parseJsonResponse(res)
        throw new Error(json?.error || "Unable to delete message")
      }

      setTickets((prev) => prev.filter((ticket) => String(ticket.id) !== ticketId))
      onTicketsChange?.(tickets.filter((ticket) => String(ticket.id) !== ticketId))
      setSelectedTicketId((prev) => {
        const next = tickets.filter((ticket) => String(ticket.id) !== ticketId)
        return next[0] ? String(next[0].id) : null
      })
      setStatus({ type: "success", message: "Message deleted" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete message"
      setStatus({ type: "error", message })
    }
  }

  return (
    <div className="grid h-screen max-h-screen grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)]">
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
                const lastReadAt = readThreads[String(thread.latestTicket.id)]
                const hasUnread = Boolean(thread.latestMessageTime) && (!lastReadAt || new Date(thread.latestMessageTime).getTime() > new Date(lastReadAt).getTime())
                return (
                  <button
                    key={thread.key}
                    type="button"
                    onClick={() => setSelectedTicketId(String(thread.latestTicket.id))}
                    className={`w-full rounded-xl border p-3 text-left transition ${isActive ? "border-[#E2AC28] bg-zinc-900" : "border-zinc-800 bg-zinc-950/70 hover:bg-zinc-900"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{thread.subject || "Support request"}</p>
                          {hasUnread && !isActive ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">{thread.latestMessageText}</p>
                      </div>
                      <Badge variant={thread.latestTicket.status === "resolved" ? "accent" : "default"}>{thread.latestTicket.status || "open"}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-zinc-500">{thread.tickets.length > 1 ? `${thread.tickets.length} messages in this chat` : "Single message"}</p>
                      <p className="text-[11px] text-zinc-500">{formatTime(thread.latestMessageTime)}</p>
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
              <button
                type="button"
                onClick={handleDeleteSelectedTicket}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-zinc-800"
              >
                Delete
              </button>
            </div>

            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(226,172,40,0.08),_transparent_50%)] p-4 space-y-3">
              {conversationMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-zinc-500">No messages yet. Start the conversation below.</p>
                </div>
              ) : (
                <>
                  {conversationMessages.map((entry) => {
                    const isOutgoing = entry.kind === "ticket" ? !isStaff : entry.senderId === profile.id
                    const { imageUrl, caption } = parseMessageContent(entry.message)
                    return (
                      <div key={entry.id} className={`flex ${isOutgoing ? "justify-end" : "justify-start"} gap-2 group`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 relative ${isOutgoing ? "rounded-br-none border border-[#E2AC28]/40 bg-[#E2AC28] text-zinc-900" : "rounded-bl-none border border-zinc-700 bg-zinc-900 text-zinc-100"}`}>
                          <p className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${isOutgoing ? "text-zinc-800/70" : "text-zinc-400"}`}>
                            {isOutgoing ? "You" : isStaff ? "Member" : "Staff"}
                          </p>
                          {imageUrl ? (
                            <div className="space-y-2">
                              <img
                                src={imageUrl}
                                alt={caption || "Shared image"}
                                className="max-w-full rounded-lg border border-zinc-700"
                                loading="lazy"
                              />
                              {caption ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{caption}</p> : null}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.message}</p>
                          )}
                          <p className={`mt-1 text-[10px] ${isOutgoing ? "text-zinc-800/60" : "text-zinc-500"}`}>{formatTime(entry.createdAt)}</p>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950/80 p-4">
              {status && (
                <p className={`mb-3 text-sm ${status.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{status.message}</p>
              )}
              <form onSubmit={handleSend} className="flex flex-col gap-2">
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelection} />
                {pendingImageName ? (
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
                    <span>📷 {pendingImageName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingImageName(null)
                        setPendingImageUrl(null)
                      }}
                      className="text-xs text-zinc-500 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-2 items-end">
                  <Textarea
                    rows={3}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value)
                      if (status) setStatus(null)
                    }}
                    placeholder={isStaff ? "Write a reply to the member" : "Write a new support message"}
                    className="flex-1 border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-500"
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 bg-zinc-900 text-zinc-100"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={loading || isUploadingImage}
                    >
                      {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    </Button>
                    <Button type="submit" size="sm" className="bg-[#E2AC28] text-black" disabled={loading || isUploadingImage}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                    </Button>
                  </div>
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
