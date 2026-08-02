"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button, Card, Textarea, Badge } from "@/components/ui/primitives"
import type { Profile, SupportTicket } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { Loader2, MessageCircleMore, SendHorizontal, Trash2, MoreVertical, ImagePlus, X } from "lucide-react"

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

function isImageUrl(value: string) {
  return /^(https?:\/\/).+\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(value.trim())
}

function splitMessageContent(message: string) {
  const lines = message
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const imageUrl = lines.find((line) => isImageUrl(line)) || null
  const text = lines.filter((line) => !isImageUrl(line)).join("\n")

  return { imageUrl, text }
}

function buildMessagePayload(text: string, imageUrl: string | null) {
  if (!text && !imageUrl) return ""
  if (!text) return imageUrl || ""
  if (!imageUrl) return text
  return `${text}\n\n${imageUrl}`
}

function getProfileDisplayName(profileLike: { full_name?: string | null; first_name?: string | null; last_name?: string | null } | null | undefined) {
  if (!profileLike) return "Staff"
  const fullName = [profileLike.first_name, profileLike.last_name].filter(Boolean).join(" ").trim()
  return fullName || profileLike.full_name || "Staff"
}

export function SupportMessenger({ profile, initialTickets = [], isStaff = false, onTicketsChange }: SupportMessengerProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTickets[0]?.id ?? null)
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [replies, setReplies] = useState<Record<string, SupportReply[]>>({})
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [busyReplyId, setBusyReplyId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [readAtByThread, setReadAtByThread] = useState<Record<string, string>>({})
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [senderProfiles, setSenderProfiles] = useState<Record<string, { id: string; full_name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null; role: string | null }>>({})
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Unable to load messages")
      const data = Array.isArray(json?.data) ? json.data : []
      setTickets(data)
      onTicketsChange?.(data)
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
    setTickets(initialTickets)

    if (!initialTickets.some((ticket) => String(ticket.id) === String(selectedTicketId))) {
      const fallbackTicket = initialTickets[0]
      setSelectedTicketId(fallbackTicket ? String(fallbackTicket.id) : null)
    }
  }, [initialTickets, selectedTicketId])

  useEffect(() => {
    if (!selectedTicketId) return

    const selectedThread = groupedThreads.find((thread) => String(thread.latestTicket.id) === String(selectedTicketId))
    if (!selectedThread) return

    setReadAtByThread((prev) => {
      if (prev[selectedThread.key]) return prev
      return { ...prev, [selectedThread.key]: new Date().toISOString() }
    })
  }, [groupedThreads, selectedTicketId])

  useEffect(() => {
    const senderIds = Array.from(new Set(conversationMessages.map((entry) => entry.senderId).filter(Boolean)))
    const missingIds = senderIds.filter((senderId) => senderId !== profile.id && !senderProfiles[senderId])

    if (missingIds.length === 0) return

    let isMounted = true

    async function loadSenderProfiles() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name, avatar_url, role")
          .in("id", missingIds)

        if (error || !data) return

        if (!isMounted) return

        const nextProfiles = data.reduce<Record<string, { id: string; full_name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null; role: string | null }>>((acc, entry) => {
          acc[entry.id] = {
            id: entry.id,
            full_name: entry.full_name ?? null,
            first_name: entry.first_name ?? null,
            last_name: entry.last_name ?? null,
            avatar_url: entry.avatar_url ?? null,
            role: entry.role ?? null,
          }
          return acc
        }, {})

        setSenderProfiles((prev) => ({ ...prev, ...nextProfiles }))
      } catch {
        // Ignore profile fetch failures and fall back to the generic label.
      }
    }

    void loadSenderProfiles()

    return () => {
      isMounted = false
    }
  }, [conversationMessages, profile.id, senderProfiles])

  useEffect(() => {
    // Scroll to bottom whenever conversation messages change
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    }, 0)
  }, [conversationMessages])

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

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setStatus(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/support/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(json?.error || "Unable to upload photo")

      const publicUrl = json?.data?.publicUrl
      if (!publicUrl) throw new Error("No photo URL returned")

      setAttachedImageUrl(publicUrl)
      setStatus({ type: "success", message: "Photo attached" })
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Unable to upload photo" })
    } finally {
      setUploadingImage(false)
      event.target.value = ""
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    const payloadMessage = buildMessagePayload(trimmed, attachedImageUrl)
    if (!payloadMessage) return

    setLoading(true)
    try {
      let res: Response
      let json: any

      if (isStaff && selectedTicket) {
        res = await fetch("/api/support/reply", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: selectedTicket.id, message: payloadMessage }),
        })
        json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "Unable to send reply")
        const newReply = {
          id: json?.data?.id || `reply-${Date.now()}`,
          ticket_id: selectedTicket.id,
          sender_id: profile.id,
          message: payloadMessage,
          created_at: new Date().toISOString(),
        }
        setReplies((prev) => ({ ...prev, [selectedTicket.id]: [...(prev[selectedTicket.id] || []), newReply] }))
        setStatus({ type: "success", message: "Reply sent" })
      } else {
        res = await fetch("/api/support", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: selectedTicket?.subject || "Support request", message: payloadMessage }),
        })
        json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "Unable to send message")
        const created = Array.isArray(json?.data) ? json.data[0] : json?.data
        if (created) {
          setTickets((prev) => {
            const next = [created, ...prev]
            onTicketsChange?.(next)
            return next
          })
          setSelectedTicketId(String(created.id))
          setStatus({ type: "success", message: "Message sent" })
        }
      }
      setDraft("")
      setAttachedImageUrl(null)
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
        onTicketsChange?.(nextTickets)
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
    <div className="grid min-h-[560px] grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="flex min-h-[560px] flex-col overflow-hidden border-zinc-800 bg-zinc-950/80 p-0">
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
                const lastReadAt = readAtByThread[thread.key]
                const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : Number.NaN
                const isUnread = !isActive && Boolean(thread.latestActivityAt) && (!Number.isFinite(lastReadTime) || thread.latestActivityAt > lastReadTime)

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
                          <p className="truncate text-sm font-semibold text-white">{thread.subject || "Support request"}</p>
                          {isUnread ? <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-white" aria-label="Unread message" /> : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">{thread.latestMessageText}</p>
                      </div>
                      <Badge variant={thread.latestTicket.status === "resolved" ? "accent" : "default"}>{thread.latestTicket.status || "open"}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] text-zinc-500">{thread.tickets.length > 1 ? `${thread.tickets.length} messages in this chat` : "Single message"}</p>
                      <p className="text-[11px] text-zinc-500">{formatTime(thread.latestMessageTime)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="flex min-h-[560px] flex-col overflow-hidden border-zinc-800 bg-zinc-950/80 p-0">
        {selectedTicket ? (
          <>
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedTicket.subject || "Support request"}</h3>
                <p className="text-xs text-zinc-500">{selectedTicket.user_email || profile.email}</p>
              </div>
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
                    const senderProfile = entry.senderId === profile.id
                      ? profile.role === "staff"
                        ? {
                            id: profile.id,
                            full_name: profile.full_name ?? null,
                            first_name: profile.first_name ?? null,
                            last_name: profile.last_name ?? null,
                            avatar_url: profile.avatar_url ?? null,
                            role: profile.role,
                          }
                        : null
                      : senderProfiles[entry.senderId] || null
                    const isStaffSender = senderProfile?.role === "staff"
                    const senderName = isStaffSender ? getProfileDisplayName(senderProfile) : null
                    const { imageUrl, text } = splitMessageContent(entry.message)
                    return (
                      <div key={entry.id} className={`flex ${isOutgoing ? "justify-end" : "justify-start"} gap-2 group`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 relative ${isOutgoing ? "rounded-br-none border border-[#E2AC28]/40 bg-[#E2AC28] text-zinc-900" : "rounded-bl-none border border-zinc-700 bg-zinc-900 text-zinc-100"}`}>
                          {isStaffSender ? (
                            <div className="mb-2 flex items-center gap-2">
                              {senderProfile?.avatar_url ? (
                                <img src={senderProfile.avatar_url} alt={senderName || "Staff avatar"} className="h-7 w-7 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold uppercase text-zinc-200">
                                  {senderName ? senderName.slice(0, 2) : "ST"}
                                </div>
                              )}
                              <p className={`text-[10px] font-bold uppercase tracking-wider ${isOutgoing ? "text-zinc-800/70" : "text-zinc-400"}`}>
                                {senderName || "Staff"}
                              </p>
                            </div>
                          ) : (
                            <p className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${isOutgoing ? "text-zinc-800/70" : "text-zinc-400"}`}>
                              {isOutgoing ? "You" : isStaff ? "Member" : "Staff"}
                            </p>
                          )}
                          {imageUrl ? <img src={imageUrl} alt="Attached support media" className="mt-2 max-h-64 w-full rounded-lg object-cover" /> : null}
                          {text ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p> : null}
                          <p className={`mt-1 text-[10px] ${isOutgoing ? "text-zinc-800/60" : "text-zinc-500"}`}>{formatTime(entry.createdAt)}</p>
                        </div>
                        {(isStaff || isOutgoing) && (
                          <div className="relative flex items-start">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                              className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === entry.id && (
                              <div className="absolute right-0 top-6 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-10">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (entry.kind === "ticket") {
                                      handleDeleteTicket(entry.id.replace("ticket-", ""))
                                    } else {
                                      handleDeleteReply(entry.id)
                                    }
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 first:rounded-t-md last:rounded-b-md flex items-center gap-2"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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
                {attachedImageUrl ? (
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
                    <img src={attachedImageUrl} alt="Attached preview" className="h-12 w-12 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-300">Photo attached</p>
                      <p className="truncate text-[11px] text-zinc-500">Ready to send</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedImageUrl(null)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      aria-label="Remove attached photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={isStaff ? "Write a reply to the member" : "Write a new support message"}
                    className="flex-1 border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-500 !text-white"
                  />
                  {isStaff ? (
                    <>
                      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handlePhotoSelect} />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 transition hover:bg-zinc-800"
                        disabled={uploadingImage}
                        aria-label="Attach a photo"
                      >
                        {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      </button>
                    </>
                  ) : null}
                  <Button type="submit" size="sm" className="bg-[#E2AC28] text-black" disabled={loading || uploadingImage}>
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
