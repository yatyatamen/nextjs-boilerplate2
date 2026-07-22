"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { DashboardShell, type NavItem } from "@/components/dashboard/shell"
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/primitives"
import type {
  Profile,
  ScheduleSession,
  Announcement,
  ShopItem,
  Assessment,
  BlogPost,
  Booking,
  SupportTicket,
  EquipmentRecommendation,
  AttendanceRecord,
  Resource,
} from "@/lib/types"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Megaphone,
  Newspaper,
  ShoppingBag,
  ClipboardList,
  Loader2,
  Plus,
  Trophy,
  Clock,
  CheckCircle2,
  UserPlus,
  BookOpen,
  Ticket,
  Mail,
  UserCheck,
  FileText,
} from "lucide-react"

const ALL_6_TIERS = ["For Fun", "Bronze", "Silver", "Gold", "Diamond", "Diamond II"]
const TIME_SLOTS = ["3:20-4:15 PM", "3:20-4:30 PM", "3:20-4:45 PM", "3:20-5:00 PM", "3:20-5:15 PM", "3:20-5:30 PM"]
const ATTENDANCE_FILTERS = ["all", "present", "absent", "late"] as const

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "members", label: "Members", icon: Users },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "Session Bookings", icon: Ticket },
  { key: "attendance", label: "Attendance", icon: UserCheck },
  { key: "resources", label: "Rubrics", icon: FileText },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "profiles", label: "Post Coach Bio", icon: UserPlus },
  { key: "shop", label: "Wolves Shop Items", icon: ShoppingBag },
  { key: "gear", label: "Equipment Guides", icon: BookOpen },
  { key: "assessments", label: "Assessments", icon: ClipboardList },
  { key: "messages", label: "Messages", icon: Mail },
]

function formatDate(date: string | null) {
  if (!date) return "TBD"
  // Handle date strings in YYYY-MM-DD format by parsing them in local timezone
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  let d: Date
  if (dateMatch) {
    const [, year, month, day] = dateMatch
    d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  } else {
    d = new Date(date)
  }
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}

function sortSessions(sessions: ScheduleSession[]) {
  const now = new Date()
  const startOfToday = new Date(now.toDateString())
  const upcoming: ScheduleSession[] = []
  const past: ScheduleSession[] = []
  sessions.forEach((s) => {
    const d = s?.date ? new Date(s.date) : null
    if (!d) {
      upcoming.push(s)
    } else if (d >= startOfToday) {
      upcoming.push(s)
    } else {
      past.push(s)
    }
  })
  upcoming.sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
  past.sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
  return [...upcoming, ...past]
}

function getMemberDisplayName(member: Profile | null | undefined) {
  if (!member) return "Member"
  return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.full_name || member.email || "Member"
}

export function StaffDashboard({
  profile,
  initialMembers,
  initialSchedule,
  initialAnnouncements,
  initialShopItems,
  initialAssessments,
  initialBookings = [],
  initialGearGuides = [],
  initialAttendanceRecords = [],
  initialMessages = [],
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialBlogPosts: BlogPost[]
  initialShopItems: ShopItem[]
  initialAssessments: Assessment[]
  initialBookings?: Booking[]
  initialGearGuides?: EquipmentRecommendation[]
  initialAttendanceRecords?: AttendanceRecord[]
  initialMessages?: SupportTicket[]
}) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")

  const [members, setMembers] = useState<Profile[]>(initialMembers)
  const [schedule, setSchedule] = useState<ScheduleSession[]>(() => sortSessions(initialSchedule || []))
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [shopItems, setShopItems] = useState<ShopItem[]>(initialShopItems)
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [gearGuides, setGearGuides] = useState<EquipmentRecommendation[]>(initialGearGuides)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialAttendanceRecords ?? [])
  const [attendanceSelection, setAttendanceSelection] = useState<Record<string, "present" | "late" | "absent">>({})
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "present" | "absent" | "late">("all")
  const [attendanceViewMode, setAttendanceViewMode] = useState<"by-session" | "all-records">("by-session")
  const [selectedAttendanceMemberId, setSelectedAttendanceMemberId] = useState<string | null>(null)
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null)
  const [pendingAttendance, setPendingAttendance] = useState<Record<string, boolean>>({})
  const [resources, setResources] = useState<Resource[]>([])
  const [newResourceTitle, setNewResourceTitle] = useState("")
  const [newResourceUrl, setNewResourceUrl] = useState("")
  const [savingResource, setSavingResource] = useState(false)
  const [membersNameEdits, setMembersNameEdits] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<SupportTicket[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [localReplies, setLocalReplies] = useState<Record<string, string[]>>({})
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)

  // initialize attendanceSelection defaults when bookings or attendanceRecords change
  useEffect(() => {
    const next: Record<string, "present" | "late" | "absent"> = { ...attendanceSelection }
    bookings.forEach((b) => {
      if (!next[b.id]) {
        const record = attendanceRecords.find((r) => r.session_id === b.session_id && r.user_id === b.user_id)
        next[b.id] = (record?.status as any) ?? "present"
      }
    })
    // only update if there are additions
    if (Object.keys(next).length !== Object.keys(attendanceSelection).length) {
      setAttendanceSelection(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, attendanceRecords])

  const displayName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email || "Staff"

  const selectedMessage = messages.find((m) => String(m.id) === selectedMessageId) ?? messages[0] ?? null

  useEffect(() => {
    // Initialize messages from server-provided data first, then attempt refresh when viewing messages
    if (messages.length === 0 && initialMessages.length > 0) {
      setMessages(initialMessages)
      if (!selectedMessageId && initialMessages.length > 0) setSelectedMessageId(String(initialMessages[0].id))
    }

    if (active !== "messages") return
    let mounted = true
    ;(async () => {
      try {
        const response = await fetch("/api/support?all=true", { credentials: "same-origin" })
        const result = await response.json().catch(() => ({ data: [] }))
        if (!mounted) return

        const nextMessages = Array.isArray(result?.data) ? (result.data as SupportTicket[]) : []
        setMessages(nextMessages)
        if (!selectedMessageId && nextMessages.length > 0) {
          setSelectedMessageId(String(nextMessages[0].id))
        }
      } catch (err) {
        console.error("Staff messages load error:", err)
      }
    })()
    return () => { mounted = false }
  }, [active, selectedMessageId])

  // Set up real-time listener for new support tickets
  useEffect(() => {
    let channel: any
    try {
      channel = supabase
        .channel("support_tickets_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "support_tickets",
          },
          (payload: any) => {
            console.log("Support ticket update:", payload)
            if (payload.eventType === "INSERT" || payload.event === "INSERT") {
              // New ticket was created
              const newTicket = (payload.new ?? payload.record) as SupportTicket
              if (newTicket) {
                setMessages((prev) => [newTicket, ...prev])
              }
            } else if (payload.eventType === "UPDATE" || payload.event === "UPDATE") {
              // Existing ticket was updated
              const updatedTicket = (payload.new ?? payload.record) as SupportTicket
              if (updatedTicket) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === updatedTicket.id ? updatedTicket : m))
                )
              }
            }
          },
        )
        .subscribe()
    } catch (err) {
      console.error("Failed to subscribe to support tickets:", err)
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  // Scroll to bottom when messages or replies change
  useEffect(() => {
    if (messagesContainerRef.current) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
        }
      }, 50)
    }
  }, [selectedMessageId, localReplies])

  // If the page is opened with a ticketId query param, open messages and select that ticket
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const ticketId = params.get("ticketId")
      if (ticketId) {
        setActive("messages")
        setSelectedMessageId(ticketId)
      }
    } catch (err) {
      // ignore (server render) or invalid URL
    }
  }, [])

  useEffect(() => {
    if (active !== "resources") return
    let mounted = true
    ;(async () => {
      try {
        const response = await fetch("/api/support/resources")
        if (!response.ok) throw new Error("Failed to fetch resources")
        const { data } = await response.json()
        if (mounted) {
          setResources(data || [])
        }
      } catch (err) {
        console.error("Failed to load resources:", err)
      }
    })()
    return () => { mounted = false }
  }, [active])

  const saveNewResource = async () => {
    if (!newResourceTitle.trim() || !newResourceUrl.trim()) {
      showToast("Please fill in both title and URL")
      return
    }
    setSavingResource(true)
    try {
      const response = await fetch("/api/support/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newResourceTitle.trim(), url: newResourceUrl.trim() }),
      })
      if (!response.ok) throw new Error("Failed to save resource")
      const { data } = await response.json()
      if (data) {
        setResources((prev) => [data, ...prev])
        setNewResourceTitle("")
        setNewResourceUrl("")
        showToast("Resource saved!")
      }
    } catch (err) {
      console.error("Error saving resource:", err)
      showToast("Failed to save resource")
    } finally {
      setSavingResource(false)
    }
  }

  const deleteResource = async (id: string) => {
    try {
      const response = await fetch(`/api/support/resources?id=${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete resource")
      setResources((prev) => prev.filter((r) => r.id !== id))
      showToast("Resource deleted")
    } catch (err) {
      console.error("Error deleting resource:", err)
      showToast("Failed to delete resource")
    }
  }

  // Keep bookings list in sync with realtime changes so staff view reflects member cancellations/rebooks
  useEffect(() => {
    if (active !== "bookings") return

    const channel = supabase.channel("realtime-bookings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        (payload: any) => {
          const newBooking = (payload.new ?? payload.record ?? payload) as Booking
          setBookings((prev) => {
            const withoutDuplicate = prev.filter((b) => !(b.user_id === newBooking.user_id && b.session_id === newBooking.session_id))
            return [...withoutDuplicate, newBooking]
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "bookings" },
        (payload: any) => {
          const oldBooking = (payload.old ?? payload.record ?? payload) as Booking
          setBookings((prev) => prev.filter((b) => b.id !== oldBooking.id))
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings" },
        (payload: any) => {
          const updated = (payload.new ?? payload.record ?? payload) as Booking
          setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
        },
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        try {
          channel.unsubscribe()
        } catch (e2) {
          // ignore
        }
      }
    }
  }, [active, supabase])

  function addStaffReply(messageId: string, replyText: string) {
    if (!replyText.trim()) return
    setLocalReplies((prev) => ({
      ...prev,
      [messageId]: [...(prev[messageId] || []), replyText.trim()],
    }))
  }

  async function handleStaffReply(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMessageId || !replyDraft.trim()) return
    try {
      const res = await fetch(`/api/support/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selectedMessageId, message: replyDraft }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        // push persisted reply to local state
        const replyText = json.data.message
        addStaffReply(selectedMessageId, replyText)
      } else {
        console.error("Reply save failed:", json.error)
        // fallback to local only
        addStaffReply(selectedMessageId, replyDraft)
      }
    } catch (err) {
      console.error("Failed to send reply:", err)
      addStaffReply(selectedMessageId, replyDraft)
    } finally {
      setReplyDraft("")
    }
  }

  // Load persisted replies when a conversation is selected
  useEffect(() => {
    let mounted = true
    async function loadReplies() {
      if (!selectedMessageId) return
      try {
        const res = await fetch(`/api/support/reply?ticketId=${selectedMessageId}`)
        const json = await res.json()
        if (!mounted) return
        if (res.ok && Array.isArray(json.data)) {
          setLocalReplies((prev) => ({ ...prev, [selectedMessageId]: json.data.map((r: any) => r.message) }))
        }
      } catch (err) {
        console.error("Failed to load replies:", err)
      }
    }

    loadReplies()
    return () => {
      mounted = false
    }
  }, [selectedMessageId])

  async function updateMemberProfile(memberId: string, updates: { fullName?: string; level?: string }) {
    const response = await fetch("/api/support/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, ...(updates.fullName ? { fullName: updates.fullName } : {}), ...(updates.level ? { level: updates.level } : {}) }),
    })

    const result = await response.json().catch(() => ({ error: "Unable to update profile." }))
    if (!response.ok) {
      throw new Error(result.error || "Unable to update profile.")
    }

    return result.data as Profile | undefined
  }

  async function saveMemberChanges(memberId: string) {
    const member = members.find((m) => m.id === memberId)
    if (!member) return

    const edit = membersNameEdits[memberId]
    const fullName = typeof edit === "string" ? edit.trim() : member.full_name ?? getMemberDisplayName(member)
    const level = member.level ?? null

    if (!fullName && !level) {
      showToast("Enter a display name or select a level before saving.")
      return
    }

    const previousMembers = members
    setMembers((prev) => prev.map((item) => (item.id === memberId ? { ...item, full_name: fullName, level } : item)))

    try {
      const payload: { fullName?: string; level?: string } = {}
      if (fullName) payload.fullName = fullName
      if (level) payload.level = level

      const updatedProfile = await updateMemberProfile(memberId, payload)
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                full_name: updatedProfile?.full_name ?? fullName,
                level: updatedProfile?.level ?? (level ?? m.level),
              }
            : m,
        ),
      )
      setMembersNameEdits((prev) => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })
      showToast("Member changes saved")
    } catch (error) {
      console.error("Failed to update member:", error)
      setMembers(previousMembers)
      showToast(error instanceof Error ? error.message : "Unable to save member changes")
    }
  }

  async function markAttendance(booking: Booking, status: "present" | "absent" | "late") {
    const member = members.find((m) => m.id === booking.user_id)
    const existingRecord = attendanceRecords.find(
      (record) => record.session_id === booking.session_id && record.user_id === booking.user_id,
    )

    const bookingKey = booking.id
    setPendingAttendance((p) => ({ ...p, [bookingKey]: true }))
    const now = new Date().toISOString()

    if (existingRecord) {
      // optimistic update
      setAttendanceRecords((prev) =>
        prev.map((record) => (record.id === existingRecord.id ? { ...record, status, marked_at: now } : record)),
      )
      try {
        const { error } = await supabase
          .from("attendance")
          .update({ status, marked_at: now })
          .eq("id", existingRecord.id)
        if (error) {
          // revert on error
          setAttendanceRecords((prev) =>
            prev.map((record) => (record.id === existingRecord.id ? existingRecord : record)),
          )
          showToast(`Failed to update attendance: ${error.message}`)
        } else {
          showToast("Attendance updated")
        }
      } catch (err) {
        setAttendanceRecords((prev) =>
          prev.map((record) => (record.id === existingRecord.id ? existingRecord : record)),
        )
        showToast("Network error updating attendance")
      } finally {
        setPendingAttendance((p) => ({ ...p, [bookingKey]: false }))
      }
      return
    }

    // create optimistic temp record
    const tempId = `temp-${Date.now()}`
    const tempRecord: AttendanceRecord = {
      id: tempId,
      session_id: String(booking.session_id ?? ""),
      user_id: String(booking.user_id ?? ""),
      user_name: member ? String((`${member.first_name ?? ""} ${member.last_name ?? ""}`).trim() || (member.email ?? "")) : "Unknown",
      user_level: String(member?.level ?? "Unknown"),
      status,
      marked_at: now,
    }
    setAttendanceRecords((prev) => [...prev, tempRecord])

    try {
      const { data, error } = await supabase
        .from("attendance")
        .insert([
          {
            session_id: String(booking.session_id ?? ""),
            user_id: String(booking.user_id ?? ""),
            user_name: tempRecord.user_name,
            user_level: tempRecord.user_level,
            status,
            marked_at: now,
          },
        ])
        .select()

      if (!error && data && data[0]) {
        const inserted = data[0] as AttendanceRecord
        setAttendanceRecords((prev) => prev.map((r) => (r.id === tempId ? inserted : r)))
        showToast("Attendance recorded")
      } else {
        // remove temp
        setAttendanceRecords((prev) => prev.filter((r) => r.id !== tempId))
        showToast(`Failed to save attendance: ${error?.message ?? "unknown error"}`)
      }
    } catch (err) {
      setAttendanceRecords((prev) => prev.filter((r) => r.id !== tempId))
      showToast("Network error saving attendance")
    } finally {
      setPendingAttendance((p) => ({ ...p, [bookingKey]: false }))
    }
  }

  return (
    <DashboardShell
      navItems={NAV}
      activeKey={active}
      onChange={setActive}
      displayName={displayName}
      subtitle={profile.email ?? ""}
      badgeLabel="Staff"
    >
      {selectedAttendanceMemberId && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-20">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedAttendanceMemberId(null)} />
          <Card className="relative z-50 w-full max-w-2xl mx-4 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Member Attendance</h3>
              <button type="button" onClick={() => setSelectedAttendanceMemberId(null)} className="text-sm text-zinc-400">Close</button>
            </div>
            <div className="space-y-2">
              {(attendanceRecords.filter(r => r.user_id === selectedAttendanceMemberId) || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded bg-zinc-900">
                  <div>
                    <div className="text-sm font-medium">{r.user_name}</div>
                    <div className="text-xs text-muted-foreground">{r.user_level} · {r.status}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.marked_at ? new Date(r.marked_at).toLocaleString() : '—'}</div>
                </div>
              ))}
              {attendanceRecords.filter(r => r.user_id === selectedAttendanceMemberId).length === 0 && (
                <p className="text-sm text-muted-foreground">No attendance records for this member.</p>
              )}
            </div>
          </Card>
        </div>
      )}
      {active === "overview" && (
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="bg-sidebar p-6 text-sidebar-foreground">
              <p className="text-sm text-sidebar-foreground/70">Staff console</p>
              <h2 className="text-2xl font-bold">Welcome, {displayName}</h2>
              <p className="mt-1 text-sm text-sidebar-foreground/70">
                Manage your multi-tier schedules, post gear guides, and upload inventory live onto the Wolves platform.
              </p>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard icon={Users} label="Members" value={members.filter((m) => m.role === "member").length} />
            <StatCard icon={CalendarDays} label="Sessions" value={schedule.length} />
            <StatCard icon={ClipboardList} label="Assessments" value={assessments.length} />
          </div>
          {announcements.length > 0 && (
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <Megaphone className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Latest Announcement</p>
                  <h3 className="mt-2 text-2xl font-bold text-foreground">{announcements[0].title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-foreground/80 whitespace-pre-line">
                    {announcements[0].content}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Posted {formatDate(announcements[0].created_at)}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {active === "members" && (
        <div>
          <SectionHeader title="Members" desc="View members and update account names and skill levels." />
          <div className="flex flex-col gap-3">
            {members.map((m) => {
              const editValue = membersNameEdits[m.id]?.trim()
              const currentName = editValue ? editValue : m.full_name ?? getMemberDisplayName(m)
              return (
                <Card key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {`${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}`.toUpperCase() || "M"}
                    </span>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">Account Name</label>
                      <Input
                        value={currentName}
                        onChange={(e) =>
                          setMembersNameEdits((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Level</Label>
                      <Select
                        value={m.level ?? ALL_6_TIERS[0]}
                        onChange={(e) => {
                          const level = e.target.value
                          setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, level } : x)))
                        }}
                        className="h-9 w-40"
                      >
                        {ALL_6_TIERS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9"
                      onClick={() => saveMemberChanges(m.id)}
                    >
                      Save Member
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {active === "schedule" && (
        <div>
          <SectionHeader title="Schedule Management" desc="Create structured, multi-tier crossing sessions visible only to qualifying members." />
          <ScheduleForm
            onCreate={async (payload) => {
              const { data, error } = await supabase
                .from("schedule")
                .insert(payload)
                .select()
              if (error) {
                alert(`Schedule DB Error: ${error.message} (${error.code})\nDetail: ${error.details}`)
                console.error("Full Error Details:", error)
                return
              }
              if (data && data[0]) setSchedule((prev) => sortSessions([...prev, data[0] as ScheduleSession]))
            }}
          />
          <div className="mt-6 flex flex-col gap-3">
            {schedule.map((s) => (
              <Card key={s.id} className="flex items-start gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="font-semibold text-foreground">{s.title ?? "Untitled Session"}</h4>
                  <p className="text-sm font-medium text-muted-foreground mt-0.5">
                    {formatDate(s.date)} · <span>{s.time ?? "TBD"}</span>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "bookings" && (
        <div>
          <SectionHeader title="Session Bookings" desc="View all member bookings for your sessions." />
          <div className="mt-6 flex flex-col gap-4">
            {schedule.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">No sessions created yet.</p>
              </Card>
            ) : (
              schedule.map((session) => {
                const sessionBookings = bookings.filter((b) => b.session_id === session.id)
                const bookedMembers = sessionBookings.map((b) => {
                  const member = members.find((m) => m.id === b.user_id)
                  return { booking: b, member }
                })

                return (
                  <Card key={session.id} className="p-4">
                    <div className="mb-3">
                      <h4 className="font-semibold text-foreground">{session.title ?? "Untitled Session"}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(session.date)} · {session.time ?? "TBD"} • Tier: {session.min_level ?? "N/A"} to {session.max_level ?? "N/A"}
                      </p>
                    </div>
                    {bookedMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No bookings yet</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {bookedMembers.length} Member{bookedMembers.length !== 1 ? "s" : ""} Booked
                        </p>
                        {bookedMembers.map(({ booking, member }) => (
                          <div
                            key={booking.id}
                            className="flex items-center justify-between rounded-md bg-muted/50 p-2.5 text-sm"
                          >
                            <div>
                              <p className="font-medium text-foreground">
                                {member?.full_name || member?.email || "Unknown Member"}
                              </p>
                              <p className="text-xs text-muted-foreground">Level: {member?.level || "N/A"}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(booking.created_at || "").toLocaleDateString()}
                                </p>
                                <p className="text-xs font-medium text-emerald-600">{booking.status}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs pointer-events-auto relative z-10 cursor-pointer"
                                  onClick={() => markAttendance(booking, "present")}
                                  disabled={!!pendingAttendance[booking.id]}
                                >
                                  {pendingAttendance[booking.id] ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                                  Present
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs pointer-events-auto relative z-10 cursor-pointer"
                                  onClick={() => markAttendance(booking, "late")}
                                  disabled={!!pendingAttendance[booking.id]}
                                >
                                  {pendingAttendance[booking.id] ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                                  Late
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs pointer-events-auto relative z-10 cursor-pointer"
                                  onClick={() => markAttendance(booking, "absent")}
                                  disabled={!!pendingAttendance[booking.id]}
                                >
                                  {pendingAttendance[booking.id] ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                                  Miss
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() =>
                                    showConfirmation(
                                      "Cancel Booking?",
                                      `Remove ${member?.full_name || "this member"} from this session?`,
                                      async () => {
                                        setConfirmLoading(true)
                                        try {
                                          const { error } = await supabase
                                            .from("bookings")
                                            .delete()
                                            .eq("id", booking.id)
                                          if (error) {
                                            console.error("❌ Cancel Booking Error:", error.message)
                                            alert(`Error cancelling booking: ${error.message}`)
                                            setConfirmLoading(false)
                                            return
                                          }
                                          setBookings((prev) => prev.filter((b) => b.id !== booking.id))
                                          closeConfirmation()
                                          showToast(`Cancelled booking for ${member?.full_name || "member"}`)
                                        } finally {
                                          setConfirmLoading(false)
                                        }
                                      }
                                    )
                                  }
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}

      {active === "attendance" && (
        <div>
          <SectionHeader title="Attendance" desc="Mark attendance and review session sign-ups for each booking." />
          
          {/* View Mode Toggle */}
          <div className="mb-6 flex gap-2">
            <Button
              variant={attendanceViewMode === "by-session" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setAttendanceViewMode("by-session")}
            >
              By Session
            </Button>
            <Button
              variant={attendanceViewMode === "all-records" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setAttendanceViewMode("all-records")}
            >
              All Records
            </Button>
          </div>

          {/* Filter Buttons */}
          <div className="mb-4 flex flex-wrap gap-2">
            {ATTENDANCE_FILTERS.map((filterOpt) => (
              <Button
                key={filterOpt}
                variant={attendanceFilter === filterOpt ? "secondary" : "outline"}
                size="sm"
                className="uppercase tracking-widest text-[10px]"
                onClick={() => setAttendanceFilter(filterOpt)}
              >
                {filterOpt === "all" ? "All" : filterOpt === "absent" ? "Miss" : filterOpt.charAt(0).toUpperCase() + filterOpt.slice(1)}
              </Button>
            ))}
          </div>

          {/* Member Filter */}
          {attendanceViewMode === "all-records" && (
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground mb-2 block">Filter by Member</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedMemberFilter === null ? "secondary" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedMemberFilter(null)}
                >
                  All Members
                </Button>
                {members.map((member) => {
                  const hasRecords = attendanceRecords.some(r => r.user_id === member.id)
                  if (!hasRecords) return null
                  return (
                    <Button
                      key={member.id}
                      variant={selectedMemberFilter === member.id ? "secondary" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedMemberFilter(member.id)}
                    >
                      {member.full_name || member.email}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {/* BY SESSION VIEW */}
          {attendanceViewMode === "by-session" && (
            <>
              {schedule.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">No sessions available to mark attendance.</p>
                </Card>
              ) : (
                schedule.map((session) => {
                  const sessionBookings = bookings.filter((b) => b.session_id === session.id)
                  const uniqueBookings = Array.from(
                    new Map(
                      sessionBookings
                        .sort((a, b) => {
                          const aDate = new Date(a.created_at || 0).getTime()
                          const bDate = new Date(b.created_at || 0).getTime()
                          return bDate - aDate
                        })
                        .map((b) => [String(b.user_id), b]),
                    ).values(),
                  )

                  const rows = uniqueBookings
                    .map((booking) => {
                      const member = members.find((m) => m.id === booking.user_id)
                      const attendance = attendanceRecords.find(
                        (record) => record.session_id === booking.session_id && record.user_id === booking.user_id,
                      )
                      const status = attendance?.status ?? "not marked"
                      return { booking, member, attendance, status }
                    })
                    .filter((row) => attendanceFilter === "all" || row.status === attendanceFilter)

                  return (
                    <Card key={session.id} className="p-4 mb-4">
                      <div className="mb-3">
                        <h4 className="font-semibold text-foreground">{session.title ?? "Untitled Session"}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(session.date)} · {session.time ?? "TBD"}
                        </p>
                      </div>
                      <div className="mb-3 flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const toSave = rows
                            for (const row of toSave) {
                              const booking = row.booking
                              const desired = attendanceSelection[booking.id] ?? "present"
                              const current = row.attendance?.status ?? "not marked"
                              if (desired !== current) {
                                await markAttendance(booking, desired)
                              }
                            }
                            showToast("Attendance saved")
                          }}
                        >
                          Save Attendance
                        </Button>
                      </div>
                      {rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No matching attendance rows for this filter.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
                          <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-300">
                              <tr>
                                <th className="px-4 py-3">Member</th>
                                <th className="px-4 py-3">Tier</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Marked At</th>
                                <th className="px-4 py-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                              {rows.map(({ booking, member, attendance, status }) => (
                                <tr key={booking.id} className="hover:bg-zinc-900">
                                  <td className="px-4 py-3 align-top">
                                    <p className="font-medium text-zinc-100">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAttendanceMemberId(member?.id ?? null)}
                                        className="text-left p-0 m-0 underline-offset-2 hover:underline"
                                      >
                                        {member?.full_name || member?.email || "Unknown Member"}
                                      </button>
                                    </p>
                                    <p className="text-xs text-zinc-400">{booking.user_id}</p>
                                  </td>
                                  <td className="px-4 py-3 align-top text-xs text-zinc-400">{member?.level || "N/A"}</td>
                                  <td className="px-4 py-3 align-top text-xs text-zinc-200 uppercase tracking-[0.08em]">{status}</td>
                                  <td className="px-4 py-3 align-top text-xs text-zinc-400">
                                    {attendance?.marked_at ? new Date(attendance.marked_at).toLocaleString() : "—"}
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <div className="flex items-center gap-3">
                                      {(["present", "late", "absent"] as const).map((opt) => (
                                        <label key={opt} className="inline-flex items-center gap-2">
                                          <input
                                            type="radio"
                                            name={`attendance-${booking.id}`}
                                            value={opt}
                                            checked={(attendanceSelection[booking.id] ?? "present") === opt}
                                            onChange={() => setAttendanceSelection((prev) => ({ ...prev, [booking.id]: opt }))}
                                          />
                                          <span className={`text-xs ${opt === "present" ? "text-emerald-400" : opt === "late" ? "text-amber-400" : "text-rose-400"}`}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  )
                })
              )}
            </>
          )}

          {/* ALL RECORDS VIEW */}
          {attendanceViewMode === "all-records" && (
            <>
              {/* Statistics */}
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold mt-1">{attendanceRecords.length}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Present</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{attendanceRecords.filter(r => r.status === "present").length}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Late</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{attendanceRecords.filter(r => r.status === "late").length}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Absent</p>
                  <p className="text-2xl font-bold text-rose-400 mt-1">{attendanceRecords.filter(r => r.status === "absent").length}</p>
                </Card>
              </div>

              {/* All Records Table */}
              {attendanceRecords.filter(r => attendanceFilter === "all" || r.status === attendanceFilter).length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">No attendance records found for the selected filter.</p>
                </Card>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-300">
                      <tr>
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3">Level</th>
                        <th className="px-4 py-3">Session Date & Title</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Marked At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {attendanceRecords
                        .filter(r => (attendanceFilter === "all" || r.status === attendanceFilter) && (selectedMemberFilter === null || r.user_id === selectedMemberFilter))
                        .sort((a, b) => new Date(b.marked_at).getTime() - new Date(a.marked_at).getTime())
                        .map((record) => {
                          const session = schedule.find(s => s.id === record.session_id)
                          return (
                            <tr key={record.id} className="hover:bg-zinc-900">
                              <td className="px-4 py-3">
                                <p className="font-medium text-zinc-100">{record.user_name}</p>
                                <p className="text-xs text-zinc-400">{record.user_id}</p>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-400">{record.user_level}</td>
                              <td className="px-4 py-3 text-xs text-zinc-300">
                                <div>{formatDate(session?.date ?? null)}</div>
                                <div className="text-zinc-400">{session?.title ?? "Unknown Session"}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  record.status === "present" ? "bg-emerald-500/10 text-emerald-400"
                                  : record.status === "late" ? "bg-amber-500/10 text-amber-400"
                                  : "bg-rose-500/10 text-rose-400"
                                }`}>
                                  {record.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-400">{new Date(record.marked_at).toLocaleString()}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {active === "resources" && (
        <div>
          <SectionHeader title="Assessment PDFs" desc="Post rubric and assessment PDFs for all members to view." />
          
          {/* Add New Resource */}
          <Card className="p-4 mb-6">
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-semibold">Add New Resource</Label>
              <Input
                placeholder="Resource title (e.g., 'Level Testing Rubric')"
                value={newResourceTitle}
                onChange={(e) => setNewResourceTitle(e.target.value)}
              />
              <Input
                placeholder="PDF URL or link"
                value={newResourceUrl}
                onChange={(e) => setNewResourceUrl(e.target.value)}
              />
              <Button
                onClick={saveNewResource}
                disabled={savingResource || !newResourceTitle.trim() || !newResourceUrl.trim()}
                className="w-full"
              >
                {savingResource ? "Saving..." : "Save Resource"}
              </Button>
            </div>
          </Card>

          {/* Resources List */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {resources.length === 0 ? (
              <Card className="p-6 text-center col-span-1 md:col-span-2">
                <p className="text-muted-foreground">No resources posted yet. Add one above to share with members!</p>
              </Card>
            ) : (
              resources.map((resource) => (
                <Card key={resource.id} className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">{resource.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(resource.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(resource.url || "", "_blank")}
                        className="flex-1"
                      >
                        Open PDF
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-rose-400 hover:text-rose-300"
                        onClick={() => deleteResource(resource.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {active === "announcements" && (
        <div>
          <SectionHeader title="Announcements" desc="Post global updates for your student body dashboard." />
          <TitleContentForm
            titleLabel="Title"
            contentLabel="Content"
            submitLabel="Post Announcement"
            onCreate={async (title, content) => {
              const { data, error } = await supabase
                .from("announcements")
                .insert({ title, content })
                .select()
              if (error) {
                alert(`Announcement DB Error: ${error.message} (${error.code})`)
                console.error("Full Error Details:", error)
                return
              }
              if (data && data[0]) setAnnouncements((prev) => [data[0] as Announcement, ...prev])
            }}
          />
        </div>
      )}

      {active === "profiles" && (
        <div>
          <SectionHeader title="Insert Leader / Coach Profile" desc="Publish biographical profile cards onto the Club About directory." />
          <CoachProfileForm
            onCreate={async (payload) => {
              const { error } = await supabase.from("leader_profiles").insert(payload)
              if (error) alert(`Profiles DB Error: ${error.message}`)
            }}
          />
        </div>
      )}

      {active === "shop" && (
        <div>
          <SectionHeader title="Wolves Shop Item Pipeline" desc="List available products into the e-commerce inventory platform matrix." />
          <ShopPostingForm
            onCreate={async (payload) => {
              const { data, error } = await supabase.from("shop_items").insert(payload).select()
              if (error) alert(`Shop DB Error: ${error.message}`)
              if (data && data[0]) setShopItems((prev) => [...prev, data[0] as ShopItem])
            }}
          />
        </div>
      )}

      {active === "gear" && (
        <div className="space-y-6">
          <SectionHeader title="Equipment Guide Publisher" desc="Upload technical equipment descriptions layout profiles." />
          <EquipmentGuideForm
            onCreate={async (payload) => {
              const { data, error } = await supabase.from("equipment_recommendations").insert(payload).select()
              if (error) {
                alert(`Guides DB Error: ${error.message}`)
                return
              }
              if (data && data[0]) {
                setGearGuides((prev) => [data[0] as EquipmentRecommendation, ...prev])
              }
            }}
          />
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Published Equipment Guides</h3>
            {gearGuides.length === 0 ? (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">No guides published yet.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {gearGuides.map((guide) => (
                  <Card key={guide.id} className="p-4 border border-zinc-800 bg-zinc-950">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{guide.title}</p>
                        <p className="text-xs text-zinc-400 mt-1">{guide.brand ?? "Equipment"}</p>
                      </div>
                      <Badge className="bg-[#E2AC28]/10 text-[#E2AC28] text-[10px] px-2 py-1 rounded-sm">Published</Badge>
                    </div>
                    <p className="mt-3 text-xs text-zinc-400 leading-relaxed">{guide.why_recommend || guide.specs || "No details available."}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {active === "assessments" && (
        <div>
          <SectionHeader title="Assessments" desc="Give feedback and instantly record a user's promotional tier." />
          <AssessmentForm
            members={members.filter((m) => m.role === "member")}
            onCreate={async ({ userId, level, feedback, date, score }) => {
              const { data, error } = await supabase
                .from("assessments")
                .insert({ user_id: userId, level, feedback, score, date })
                .select()
              if (error) {
                alert(`Assessment DB Error: ${error.message}`)
                return
              }
              if (data && data[0]) {
                setAssessments((prev) => [data[0] as Assessment, ...prev])
                await supabase.from("profiles").update({ level }).eq("id", userId)
                setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, level } : m)))
              }
            }}
          />
        </div>
      )}

      {active === "messages" && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 h-[70vh]">
          {/* Conversations list */}
          <div className="flex flex-col gap-4">
            <div>
              <SectionHeader title="Messages" desc="Member conversations — chat-style view." />
            </div>
            {messages.length === 0 ? (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
              </Card>
            ) : (
              <div className="space-y-2 overflow-auto">
                {messages.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMessageId(String(m.id))}
                    className={`flex items-start gap-3 w-full rounded-xl border p-3 text-left ${selectedMessageId === String(m.id) ? "border-[#E2AC28] bg-zinc-950" : "border-zinc-800 bg-zinc-900/90 hover:bg-zinc-950"}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">{(m.user_email || String(m.user_id) || "?").slice(0,2).toUpperCase()}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white truncate">{m.subject || "Message"}</p>
                        <span className="text-[10px] text-zinc-500">{new Date(m.created_at || "").toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.message}</p>
                      <p className="text-[10px] text-zinc-500 mt-2">{m.user_email || m.user_id}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat thread */}
          <div className="flex flex-col gap-4">
            <Card className="rounded-2xl border p-0 bg-zinc-950 border-zinc-800 flex flex-col h-full overflow-hidden">
              {!selectedMessage ? (
                <div className="p-6">
                  <p className="text-sm font-semibold text-white">Select a conversation to open the chat.</p>
                  <p className="text-xs text-muted-foreground mt-2">This view behaves like a messaging app — click a thread to reply.</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedMessage.subject || "Conversation"}</p>
                      <p className="text-xs text-muted-foreground">{selectedMessage.user_email || selectedMessage.user_id}</p>
                    </div>
                    <div className="text-xs text-zinc-500">{selectedMessage.status}</div>
                  </div>

                  {/* Messages area */}
                  <div className="flex-1 overflow-auto p-4 space-y-4" ref={messagesContainerRef}>
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">{(selectedMessage.user_email || String(selectedMessage.user_id)).slice(0,2).toUpperCase()}</div>
                      <div className="bg-zinc-900 p-3 rounded-2xl max-w-[75%]">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#E2AC28] mb-2">Member</p>
                        <p className="text-sm text-zinc-100 whitespace-pre-line">{selectedMessage.message}</p>
                        <p className="text-[10px] text-zinc-500 mt-2">
                          {new Date(selectedMessage.created_at || "").toLocaleDateString()} at {new Date(selectedMessage.created_at || "").toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    {(localReplies[selectedMessageId ?? ""] || []).map((reply, index) => (
                      <div key={index} className="flex items-start gap-3 justify-end">
                        <div className="bg-[#E2AC28]/10 p-3 rounded-2xl max-w-[75%] text-sm text-zinc-100">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[#E2AC28] mb-2">You</p>
                          <p>{reply}</p>
                          <p className="text-[10px] text-zinc-500 mt-2">{new Date().toLocaleDateString()} at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-[#E2AC28]/10 flex items-center justify-center text-[#E2AC28] text-xs font-semibold">ST</div>
                      </div>
                    ))}
                  </div>

                  {/* Reply input (sticky at bottom) */}
                  <div className="p-4 border-t border-zinc-800 bg-zinc-950">
                    <form onSubmit={handleStaffReply} className="flex items-center gap-3">
                      <Textarea
                        rows={2}
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        className="flex-1 resize-none bg-zinc-900 border-zinc-800"
                        placeholder="Write your reply..."
                      />
                      <Button type="submit" size="sm" className="bg-[#E2AC28] text-black">Send</Button>
                    </form>
                    <p className="text-[11px] text-zinc-500 mt-2">Replies are stored locally in this view and not sent as emails.</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isLoading={confirmLoading}
        onConfirm={() => confirmState.onConfirm()}
        onCancel={closeConfirmation}
      />

      <Toast isOpen={toast.isOpen} message={toast.message} />
    </DashboardShell>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}

function useSubmitting() {
  const [loading, setLoading] = useState(false)
  return { loading, setLoading }
}

function ScheduleForm({
  onCreate,
}: {
  onCreate: (payload: {
    title: string
    date: string
    time: string
    visibility_tiers: string[]
    coach: string
    notes: string
  }) => Promise<void>
}) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [selectedTiers, setSelectedTiers] = useState<string[]>(ALL_6_TIERS)
  const [coach, setCoach] = useState("")
  const [notes, setNotes] = useState("")

  const toggleTier = (tier: string) => {
    setSelectedTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) return
    
    showConfirmation(
      "Create New Session?",
      `Schedule session for ${formatDate(date)} at ${time || "TBD"}?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate({
            title,
            date,
            time,
            visibility_tiers: selectedTiers,
            coach,
            notes,
          })
          setTitle("")
          setDate("")
          setTime("")
          setCoach("")
          setNotes("")
          closeConfirmation()
          showToast("✓ Session posted successfully!")
        } finally {
          setConfirmLoading(false)
        }
      }
    )
  }

  return (
    <>
      <Card className="p-5">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="s-title">Session Title</Label>
            <Input id="s-title" placeholder="e.g., Free play section" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-date">Date</Label>
            <Input
              id="s-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-amber-500 font-mono bg-background"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-time">Time Span</Label>
            <Select id="s-time" value={time} onChange={(e) => setTime(e.target.value)} required>
              <option value="">Select time slot</option>
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 border border-zinc-800 p-3 rounded bg-zinc-950/40">
            <Label className="text-[#E2AC28] font-bold">Select Visible Ranks</Label>
            <div className="flex flex-wrap gap-4">
              {ALL_6_TIERS.map((tier) => (
                <label key={tier} className="flex items-center gap-2 text-xs font-mono text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTiers.includes(tier)}
                  onChange={() => toggleTier(tier)}
                  className="accent-[#E2AC28] h-4 w-4"
                />
                {tier}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="s-coach">Assigned Lead / Coach</Label>
          <Input id="s-coach" placeholder="Name" value={coach} onChange={(e) => setCoach(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="s-notes">Session Notes</Label>
          <Textarea id="s-notes" placeholder="Constraints description..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading} className="bg-[#E2AC28] text-black font-bold">
            Inject Active Session Slot
          </Button>
        </div>
      </form>
      <ConfirmationDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isLoading={confirmLoading}
        onConfirm={() => confirmState.onConfirm()}
        onCancel={closeConfirmation}
      />
    </Card>
    <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function TitleContentForm({
  titleLabel,
  contentLabel,
  submitLabel,
  onCreate,
}: {
  titleLabel: string
  contentLabel: string
  submitLabel: string
  onCreate: (title: string, content: string) => Promise<void>
}) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    
    showConfirmation(
      `${submitLabel}?`,
      `Confirm: "${title.trim()}"`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate(title.trim(), content.trim())
          setTitle("")
          setContent("")
          closeConfirmation()
          showToast("✓ Content posted successfully!")
        } finally {
          setConfirmLoading(false)
        }
      }
    )
  }

  return (
    <>
      <Card className="p-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-1.5">
            <Label>{titleLabel}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{contentLabel}</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-28" required />
          </div>
          <div>
            <Button type="submit" disabled={loading} className="bg-[#E2AC28] text-black font-bold">
              {submitLabel}
            </Button>
          </div>
        </form>
        <ConfirmationDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          isLoading={confirmLoading}
          onConfirm={() => confirmState.onConfirm()}
          onCancel={closeConfirmation}
        />
      </Card>
      <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function CoachProfileForm({ onCreate }: { onCreate: (payload: { name: string; description: string; pic_url: string; role_title: string }) => Promise<void> }) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [picUrl, setPicUrl] = useState("")
  const [roleTitle, setRoleTitle] = useState("Coach")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    showConfirmation(
      "Publish Coach Profile?",
      `Add "${name}" to the coaches directory as ${roleTitle}?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate({ name, description, pic_url: picUrl, role_title: roleTitle })
          setName("")
          setDescription("")
          setPicUrl("")
          setRoleTitle("Coach")
          setSuccess(true)
          setTimeout(() => setSuccess(false), 3000)
          closeConfirmation()
          showToast(`✓ ${name} added to coaches!`)
        } finally {
          setConfirmLoading(false)
        }
      }
    )
  }

  return (
    <>
      <Card className="p-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Coach / Leader Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Profile Picture URL</Label>
            <Input value={picUrl} onChange={(e) => setPicUrl(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role Type</Label>
            <Select value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)}>
              <option value="Coach">Coach</option>
              <option value="Leader">Leader</option>
              <option value="Teacher">Teacher</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Biography & Credentials</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={loading} className="bg-[#E2AC28] text-black font-bold">
              Post Leader Profile Card
            </Button>
            {success && <span className="text-sm text-emerald-500">Profile online!</span>}
          </div>
        </form>
        <ConfirmationDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          isLoading={confirmLoading}
          onConfirm={() => confirmState.onConfirm()}
          onCancel={closeConfirmation}
        />
      </Card>
      <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function ShopPostingForm({ onCreate }: { onCreate: (payload: { name: string; category: string; price: number; description: string; pic_url: string; stock: number; unit: string }) => Promise<void> }) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("Rackets")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [picUrl, setPicUrl] = useState("")
  const [stock, setStock] = useState(0)
  const [unit, setUnit] = useState("units")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
          showConfirmation(
      "Add Shop Item?",
      `List "${name}" for $${Number(price) || 0} in ${category}?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate({ name, category, price: Number(price) || 0, description, pic_url: picUrl, stock: Number(stock) || 0, unit })
          setName("")
          setPrice("")
          setDescription("")
          setPicUrl("")
          setStock(0)
          setUnit("units")
          closeConfirmation()
          showToast(`✓ ${name} added to shop!`)
        } finally {
          setConfirmLoading(false)
        }
      }
    )
  }

  return (
    <>
      <Card className="p-5">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-1.5"><Label>Product Title</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Rackets">Rackets</option>
              <option value="Strings">Strings</option>
              <option value="Grips">Grips</option>
              <option value="Birdies">Birdies</option>
              <option value="Others">Others</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Price ($)</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
          <div className="flex flex-col gap-1.5"><Label>Display Picture URL</Label><Input value={picUrl} onChange={(e) => setPicUrl(e.target.value)} required /></div>
          <div className="flex flex-col gap-1.5"><Label>Stock Quantity</Label><Input type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value))} /></div>
          <div className="flex flex-col gap-1.5"><Label>Unit Label</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="units, set, pack, box" /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label>Specification Overview</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <Button type="submit" disabled={loading} className="sm:col-span-2 bg-[#E2AC28] text-black font-bold">List Product Stock</Button>
        </form>
        <ConfirmationDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          isLoading={confirmLoading}
          onConfirm={() => confirmState.onConfirm()}
          onCancel={closeConfirmation}
        />
      </Card>
      <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function EquipmentGuideForm({ onCreate }: { onCreate: (payload: { title: string; category: string; description: string; image_url: string; recommended_for_tier: string; specs: string }) => Promise<void> }) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("Rackets")
  const [description, setDescription] = useState("")
  const [picUrl, setPicUrl] = useState("")
  const [recommendedTiers, setRecommendedTiers] = useState<string[]>(["Beginner"])
  const [priceEstimate, setPriceEstimate] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    showConfirmation(
      "Publish Equipment Guide?",
      `Publish "${title}" guide for ${category} (${recommendedTiers.join(", ")})?`,
      async () => {
        setConfirmLoading(true)
        try {
          const specs = priceEstimate ? `Estimated price: $${Number(priceEstimate).toFixed(2)}` : ""
          const recommended_for_tier = recommendedTiers.join(", ")
          await onCreate({ title, category, description, image_url: picUrl, recommended_for_tier, specs })
          setTitle("")
          setDescription("")
          setPicUrl("")
          setRecommendedTiers(["Beginner"])
          setPriceEstimate("")
          closeConfirmation()
          showToast(`✓ ${title} guide published!`)
        } finally {
          setConfirmLoading(false)
        }
      }
    )
  }

  return (
    <>
      <Card className="p-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5"><Label>Gear Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="flex flex-col gap-1.5">
              <Label>Guide Category Target</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Rackets">Rackets</option>
                <option value="Strings">Strings</option>
                <option value="Grips">Grips</option>
                <option value="Birdies">Birdies</option>
                <option value="Others">Others</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5"><Label>Image URL Reference</Label><Input value={picUrl} onChange={(e) => setPicUrl(e.target.value)} required /></div>
            <div className="flex flex-col gap-1.5"><Label>Estimated Price ($)</Label><Input type="number" step="0.01" value={priceEstimate} onChange={(e) => setPriceEstimate(e.target.value)} placeholder="79.99" /></div>
            <div className="flex flex-col gap-1.5">
              <Label>Recommended Tier</Label>
              <div className="flex gap-3 items-center">
                {["Beginner", "Intermediate", "Advanced"].map((tier) => (
                  <label key={tier} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={recommendedTiers.includes(tier)}
                      onChange={(e) => {
                        setRecommendedTiers((prev) =>
                          e.target.checked ? [...prev.filter(Boolean), tier] : prev.filter((t) => t !== tier),
                        )
                      }}
                    />
                    <span>{tier}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Technical Recommendation Summary</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
          <Button type="submit" disabled={loading} className="bg-[#E2AC28] text-black font-bold">Publish Review Guide</Button>
        </form>
        <ConfirmationDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          isLoading={confirmLoading}
          onConfirm={() => confirmState.onConfirm()}
          onCancel={closeConfirmation}
        />
      </Card>
      <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function AssessmentForm({
  members,
  onCreate,
}: {
  members: Profile[]
  onCreate: (payload: { userId: string; level: string; feedback: string; date: string; score: number }) => Promise<void>
}) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState("")
  const [level, setLevel] = useState<string>(ALL_6_TIERS[0])
  const [score, setScore] = useState<number>(80)
  const [feedback, setFeedback] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const selectedMember = members.find((m) => m.id === userId)
  const memberName = selectedMember 
    ? `${selectedMember.first_name ?? ""} ${selectedMember.last_name ?? ""}`.trim() || selectedMember.email
    : "Member"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    
    showConfirmation(
      "Save Assessment?",
      `Set ${memberName}'s level to ${level}?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate({
            userId,
            level,
            feedback: feedback.trim(),
            date,
            score,
          })
          setFeedback("")
          setSuccess(true)
          setTimeout(() => setSuccess(false), 5000)
          closeConfirmation()
          showToast(`✓ Assessment saved for ${memberName}!`)
        } finally {
          setConfirmLoading(false)
        }
      }
    )
  }

  return (
    <>
      <Card className="p-5">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Member</Label>
            <Select value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">Select a member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Level</Label>
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              {ALL_6_TIERS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-amber-500 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Score</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full h-8 accent-[#E2AC28]"
              />
              <span className="w-12 text-right text-sm font-semibold">{score}%</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Feedback</Label>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback..." className="min-h-28" required />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={loading} className="bg-[#E2AC28] text-black font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Save Assessment Record
            </Button>
            {success && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-500">
                <CheckCircle2 className="h-4 w-4" /> Grade Record Dispatched!
              </span>
            )}
          </div>
        </form>
        <ConfirmationDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          isLoading={confirmLoading}
          onConfirm={() => confirmState.onConfirm()}
          onCancel={closeConfirmation}
        />
      </Card>
      <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function useConfirmation() {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => Promise<void>
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: async () => {},
  })

  const showConfirmation = (title: string, message: string, onConfirm: () => Promise<void>) => {
    setConfirmState({ isOpen: true, title, message, onConfirm })
  }

  const closeConfirmation = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }))
  }

  return { confirmState, showConfirmation, closeConfirmation }
}

function ConfirmationDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 p-6 shadow-xl">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Confirm
          </Button>
        </div>
      </Card>
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState<{
    isOpen: boolean
    message: string
  }>({
    isOpen: false,
    message: "",
  })

  const showToast = (message: string) => {
    setToast({ isOpen: true, message })
    setTimeout(() => {
      setToast({ isOpen: false, message: "" })
    }, 3000)
  }

  return { toast, showToast }
}

function Toast({
  isOpen,
  message,
}: {
  isOpen: boolean
  message: string
}) {
  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-white shadow-lg">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="font-medium">{message}</span>
      </div>
    </div>
  )
}