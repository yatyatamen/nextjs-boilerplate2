"use client"

import { useState, useEffect, useRef } from "react"
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
import { ALL_ROLE_AND_TIER_OPTIONS, LEVELS, ROLES } from "@/lib/types"
import { isSessionEnded } from "@/lib/scheduling"
import {
  getEmailTemplateConfig,
  saveEmailTemplateConfig,
  type EmailTemplateConfig,
} from "@/lib/email-templates"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Megaphone,
  ShoppingBag,
  ClipboardList,
  Loader2,
  Trophy,
  CheckCircle2,
  BookOpen,
  Ticket,
  UserCheck,
  Image,
  MoreHorizontal,
  XCircle,
  MessageSquareText,
} from "lucide-react"

function formatDate(date: string | null) {
  if (!date) return "TBD"
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  let d: Date
  if (dateMatch) {
    const [, year, month, day] = dateMatch
    d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  } else {
    d = new Date(date)
  }
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function isFeatureAnnouncement(title: string | null | undefined) {
  const normalized = String(title ?? "").toLowerCase()
  return normalized.includes("website") || normalized.includes("feature")
}

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "members", label: "Members", icon: Users },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "Bookings", icon: Ticket },
  { key: "attendance", label: "Attendance", icon: UserCheck },
  { key: "resources", label: "Resources", icon: BookOpen },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "email-templates", label: "Email Templates", icon: Megaphone },
  { key: "shop", label: "Shop", icon: ShoppingBag },
  { key: "gear", label: "Gear Guides", icon: Trophy },
  { key: "assessments", label: "Assessments", icon: ClipboardList },
  { key: "comments", label: "Comments", icon: MessageSquareText },
]
const ALL_TIERS = [...LEVELS]
const TIME_SLOTS = ["3:20-4:30 PM", "3:20-4:45 PM", "3:20-5:00 PM", "3:20-5:15 PM"] as const
const ATTENDANCE_FILTERS = ["all", "present", "absent", "late"] as const
const ATTENDANCE_DAY_FILTERS = ["all", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const
const ATTENDANCE_MONTH_FILTERS = ["all", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const

type AttendanceFilter = typeof ATTENDANCE_FILTERS[number]
type AttendanceDayFilter = typeof ATTENDANCE_DAY_FILTERS[number]
type AttendanceMonthFilter = typeof ATTENDANCE_MONTH_FILTERS[number]

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

function parseImageUrls(value: string | null | undefined): string[] {
  if (!value) return []
  const trimmed = value.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
    }
  } catch {}
  return trimmed
    .split(/\n|,|;/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function getWeekdayLabel(dateValue: string | null | undefined) {
  if (!dateValue) return "Unknown"
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = dateMatch
    ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
    : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date)
}

function getMonthLabel(dateValue: string | null | undefined) {
  if (!dateValue) return "Unknown"
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = dateMatch
    ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
    : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(date)
}

export function StaffDashboard({
  profile,
  initialMembers,
  initialSchedule,
  initialAnnouncements,
  initialAssessments,
  initialBookings = [],
  initialGearGuides = [],
  initialShopItems = [],
  initialAttendanceRecords = [],
  initialMessages = [],
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialBlogPosts: BlogPost[]
  initialShopItems?: ShopItem[]
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
  const [websiteFeatureText, setWebsiteFeatureText] = useState("")
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [gearGuides, setGearGuides] = useState<EquipmentRecommendation[]>(initialGearGuides)
  const [shopItems, setShopItems] = useState<ShopItem[]>(initialShopItems ?? [])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialAttendanceRecords ?? [])
  const [attendanceSelection, setAttendanceSelection] = useState<Record<string, "present" | "late" | "absent">>({})
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all")
  const [attendanceDayFilter, setAttendanceDayFilter] = useState<AttendanceDayFilter>("all")
  const [attendanceMonthFilter, setAttendanceMonthFilter] = useState<AttendanceMonthFilter>("all")
  const [attendanceTierFilter, setAttendanceTierFilter] = useState<string>("all")
  const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>("all")
  const [attendanceViewMode, setAttendanceViewMode] = useState<"by-session" | "all-records">("by-session")
  const [selectedAttendanceMemberId, setSelectedAttendanceMemberId] = useState<string | null>(null)
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null)
  const [pendingAttendance, setPendingAttendance] = useState<Record<string, boolean>>({})
  const [resources, setResources] = useState<Resource[]>([])
  const [newResourceTitle, setNewResourceTitle] = useState("")
  const [newResourceUrl, setNewResourceUrl] = useState("")
  const [savingResource, setSavingResource] = useState(false)
  const [memberSearch, setMemberSearch] = useState("")
  const [membersNameEdits, setMembersNameEdits] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<SupportTicket[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [replyingTo, setReplyingTo] = useState<{ id: string; message: string; author?: string } | null>(null)
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null)
  const [localReplies, setLocalReplies] = useState<Record<string, string[]>>({})
  const [staffFile, setStaffFile] = useState<File | null>(null)
  const [commentFilter, setCommentFilter] = useState<"all" | "unread" | "solved">("all")
  const [assessmentTierFilter, setAssessmentTierFilter] = useState<string>("all")
  const [assessmentSearch, setAssessmentSearch] = useState("")
  const [announcementSearch, setAnnouncementSearch] = useState("")
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateConfig>(() => getEmailTemplateConfig())
  const [showNoAnnouncement, setShowNoAnnouncement] = useState(false)
  const [showNoFeatureAnnouncement, setShowNoFeatureAnnouncement] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)

  async function sendConfiguredEmail(
    event: "announcement" | "session_alert" | "assessment" | "absence" | "shop_update",
    to: string,
    payload: Record<string, string>,
  ) {
    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, to, template: emailTemplates[event], ...payload }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        console.error(`Failed to send ${event} email:`, result.error)
        return false
      }

      return true
    } catch (error) {
      console.error(`Failed to send ${event} email:`, error)
      return false
    }
  }

  // initialize attendanceSelection defaults when bookings or attendanceRecords change
  useEffect(() => {
    const next: Record<string, "present" | "late" | "absent"> = {}
    bookings.forEach((booking) => {
      const record = attendanceRecords.find((r) => r.session_id === booking.session_id && r.user_id === booking.user_id)
      next[booking.id] = (record?.status as any) ?? attendanceSelection[booking.id] ?? "present"
    })

    setAttendanceSelection((prev) => {
      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)
      const changed = prevKeys.length !== nextKeys.length || nextKeys.some((key) => prev[key] !== next[key])
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, attendanceRecords])

  const displayName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email || "Staff"

  const normalizeCommentStatus = (status: SupportTicket["status"] | string | null | undefined) => {
    if (!status) return "unread"
    if (status === "resolved") return "solved"
    if (status === "open") return "unread"
    if (status === "solved" || status === "unread") return status
    return "unread"
  }

  const filteredComments = messages.filter((message) => {
    const normalized = normalizeCommentStatus(message.status)
    if (commentFilter === "all") return true
    return normalized === commentFilter
  })

  const announcementList: Announcement[] = Array.isArray(announcements) ? announcements : []

  const latestGeneralAnnouncement = showNoAnnouncement
    ? null
    : [...announcementList]
        .filter((item: Announcement) => !isFeatureAnnouncement(item.title))
        .sort((a: Announcement, b: Announcement) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  const latestFeatureAnnouncement = showNoFeatureAnnouncement
    ? null
    : [...announcementList]
        .filter((item: Announcement) => isFeatureAnnouncement(item.title))
        .sort((a: Announcement, b: Announcement) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  async function hideLatestAnnouncement(featureOnly: boolean) {
    const announcementsToHide = announcementList.filter((item) =>
      featureOnly ? isFeatureAnnouncement(item.title) : !isFeatureAnnouncement(item.title),
    )
    if (announcementsToHide.length === 0) {
      showToast(featureOnly ? "No website feature announcement to hide" : "No announcement to hide")
      return
    }

    const results = await Promise.all(
      announcementsToHide.map((item) => deleteAnnouncementItem(item.id)),
    )
    if (results.some((result) => !result)) {
      showToast("Unable to hide one or more announcements")
      return
    }

    const announcementIds = announcementsToHide.map((item) => item.id)
    setAnnouncements((prev) => prev.filter((item) => !announcementIds.includes(item.id)))
    if (featureOnly) {
      setShowNoFeatureAnnouncement(true)
    } else {
      setShowNoAnnouncement(true)
    }
    showToast(featureOnly ? "Website feature announcement hidden" : "Announcement hidden")
  }

  const selectedMessage = messages.find((m) => String(m.id) === selectedMessageId) ?? messages[0] ?? null

  async function deleteScheduleItem(id: string) {
    const { error } = await supabase.from("schedule").delete().eq("id", id)
    if (error) {
      alert(`Schedule delete failed: ${error.message}`)
      return
    }
    setSchedule((prev) => prev.filter((item) => item.id !== id))
  }

  async function updateScheduleItem(id: string, payload: Partial<ScheduleSession>) {
    const { data, error } = await supabase
      .from("schedule")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message || "Unable to update schedule item")
    }

    setSchedule((prev) => sortSessions(prev.map((item) => (item.id === id ? { ...item, ...(data as ScheduleSession) } : item))))
  }

  const confirmAction = (title: string, message: string, callback: () => Promise<void> | void) => {
    showConfirmation(title, message, async () => {
      closeConfirmation()
      await callback()
    })
  }

  async function deleteGearGuide(id: string) {
    const response = await fetch("/api/staff/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "gear_guide" }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      alert(`Gear guide delete failed: ${result.error || "Unable to delete item"}`)
      return
    }
    setGearGuides((prev) => prev.filter((item) => item.id !== id))
  }

  async function deleteShopItem(id: string) {
    const response = await fetch("/api/staff/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "shop_item" }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      alert(`Shop item delete failed: ${result.error || "Unable to delete item"}`)
      return
    }
    setShopItems((prev) => prev.filter((item) => item.id !== id))
  }

  async function updateShopStock(id: string, stock: number, unit: string) {
    const { data, error } = await supabase
      .from("shop_items")
      .update({ stock, unit })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw new Error(`Shop stock update failed: ${error.message}`)
    }

    setShopItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...(data as ShopItem) } : item)))
  }

  async function updateExistingShopItem(id: string, payload: Partial<ShopItem>) {
    const { data, error } = await supabase
      .from("shop_items")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message || "Unable to update shop item")
    }

    setShopItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...(data as ShopItem) } : item)))
  }

  async function updateExistingGearGuide(id: string, payload: Partial<EquipmentRecommendation>) {
    const { data, error } = await supabase
      .from("equipment_recommendations")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle()

    if (error) {
      throw new Error(error.message || "Unable to update gear guide")
    }

    setGearGuides((prev) => prev.map((guide) => (guide.id === id ? { ...guide, ...(data as EquipmentRecommendation) } : guide)))
  }

  async function deleteAssessmentItem(id: string) {
    const { error } = await supabase.from("assessments").delete().eq("id", id)
    if (error) {
      alert(`Assessment delete failed: ${error.message}`)
      return
    }
    setAssessments((prev) => prev.filter((item) => item.id !== id))
  }

  async function deleteAnnouncementItem(id: string) {
    const response = await fetch("/api/staff/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "announcement" }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      alert(`Announcement delete failed: ${result.error || "Unable to delete announcement"}`)
      return false
    }
    setAnnouncements((prev) => prev.filter((item) => item.id !== id))
    return true
  }

  async function deleteSupportTicketItem(id: string) {
    try {
      const response = await fetch("/api/support/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "ticket" }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Unable to delete comment")
      }
      setMessages((prev) => prev.filter((item) => String(item.id) !== String(id)))
      if (selectedMessageId === String(id)) setSelectedMessageId(null)
      showToast("Comment deleted")
    } catch (error) {
      console.error("Delete comment failed:", error)
      showToast(error instanceof Error ? error.message : "Failed to delete comment")
    }
  }

  const confirmDelete = (label: string, onConfirm: () => Promise<void> | void) => {
    showConfirmation(
      "Delete this item?",
      `Are you sure you want to delete this ${label}? This action cannot be undone.`,
      async () => {
        closeConfirmation()
        await onConfirm()
      },
    )
  }

  async function updateCommentStatusInDb(id: string, nextStatus: SupportTicket["status"]) {
    const { error } = await supabase.from("support_tickets").update({ status: nextStatus }).eq("id", id)

    if (error) {
      throw new Error(error.message || "Unable to update comment status")
    }

    setMessages((prev) => prev.map((message) => message.id === id ? { ...message, status: nextStatus } : message))
    showToast("Comment status updated")
  }

  function updateCommentStatus(id: string, nextStatus: SupportTicket["status"]) {
    const label = nextStatus === "solved" ? "Solved" : "Unread"
    showConfirmation(
      "Update comment status?",
      `Mark this comment as ${label}? This will update the ticket record for the staff queue.`,
      async () => {
        closeConfirmation()
        try {
          await updateCommentStatusInDb(id, nextStatus)
        } catch (error) {
          console.error("Update comment status failed:", error)
          showToast(error instanceof Error ? error.message : "Failed to update comment status")
        }
      },
    )
  }

  function getMessageSenderName(message: SupportTicket | null | undefined) {
    if (!message) return "Member"
    const member = members.find((entry) => entry.id === message.user_id)
    return getMemberDisplayName(member) || message.user_email || message.user_id || "Member"
  }

  function getProfileAvatar(profileEntry: Partial<Profile> | null | undefined) {
    return typeof profileEntry?.avatar_url === "string" && profileEntry.avatar_url.trim()
      ? profileEntry.avatar_url
      : null
  }

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
        const { data, error } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false })
        if (mounted && !error && data) {
          setMessages(data as SupportTicket[])
          if (!selectedMessageId && data.length > 0) {
            setSelectedMessageId(String(data[0].id))
          }
        }
      } catch (_err) {
        console.error("Staff messages load error:")
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (_err) {
      console.error("Failed to subscribe to support tickets:")
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  // Scroll to bottom when a conversation is opened or when messages/replies change
  useEffect(() => {
    if (active !== "messages") return

    const frame = window.requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [active, selectedMessageId, messages, localReplies])

  // If the page is opened with a ticketId query param, open messages and select that ticket
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const ticketId = params.get("ticketId")
      if (ticketId) {
        setActive("messages")
        setSelectedMessageId(ticketId)
      }
    } catch (_err) {
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
      } catch (_err) {
        console.error("Failed to load resources:")
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
    } catch (_err) {
      console.error("Error saving resource:")
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
    } catch (_err) {
      console.error("Error deleting resource:")
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
      } catch (_e) {
        try {
          channel.unsubscribe()
        } catch (_e2) {
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

  async function handleStaffFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStaffFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleStaffReplyToMessage(messageId: string, message: string, author?: string) {
    setReplyingTo({ id: messageId, message, author })
  }

  async function handleDeleteStaffReply(messageId: string, index: number) {
    setLocalReplies((prev) => {
      const replies = prev[messageId] || []
      return { ...prev, [messageId]: replies.filter((_, i) => i !== index) }
    })
  }

  async function handleStaffReply(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMessageId) return

    const bodyText = replyDraft.trim()
    const hasFile = Boolean(staffFile)
    if (!bodyText && !hasFile) return

    let finalMessage = bodyText
    let uploadError = false

    if (staffFile) {
      try {
        const fd = new FormData()
        fd.append("file", staffFile)

        const uploadRes = await fetch("/api/support/upload", {
          method: "POST",
          body: fd,
        })
        const uploadJson = await uploadRes.json()
        if (!uploadRes.ok || !uploadJson?.data?.publicUrl) {
          uploadError = true
          console.error("Attachment upload failed:", uploadJson?.error)
        } else {
          const attachmentUrl = uploadJson.data.publicUrl
          const attachmentLabel = `Attachment: ${staffFile.name} — ${attachmentUrl}`
          finalMessage = bodyText ? `${bodyText}\n\n${attachmentLabel}` : attachmentLabel
        }
      } catch (_err) {
        uploadError = true
        console.error("Attachment upload failed:")
      }
    }

    if (!finalMessage.trim()) return

    try {
      const res = await fetch(`/api/support/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selectedMessageId, message: finalMessage }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        const replyText = json.data.message
        addStaffReply(selectedMessageId, replyText)
      } else {
        console.error("Reply save failed:", json.error)
        addStaffReply(selectedMessageId, finalMessage)
      }
    } catch (_err) {
      console.error("Failed to send reply:")
      addStaffReply(selectedMessageId, finalMessage)
    } finally {
      setReplyDraft("")
      setStaffFile(null)
    }

    if (uploadError) {
      showToast("Reply sent, but attachment upload failed.")
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
      } catch (_err) {
        console.error("Failed to load replies:")
      }
    }

    loadReplies()
    return () => {
      mounted = false
    }
  }, [selectedMessageId])

  async function updateMemberProfile(memberId: string, updates: { fullName?: string; level?: string; role?: string }) {
    const response = await fetch("/api/support/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, ...(updates.fullName ? { fullName: updates.fullName } : {}), ...(updates.level ? { level: updates.level } : {}), ...(updates.role ? { role: updates.role } : {}) }),
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
    const role = member.role ?? "member"

    if (!fullName && !level && !role) {
      showToast("Enter a display name or select a level before saving.")
      return
    }

    const summary = `${fullName || member.email || "this member"} • ${role} • ${level ?? "No level"}`

    showConfirmation(
      "Save member update?",
      `This will update ${summary}. Confirm to save these changes.`,
      async () => {
        closeConfirmation()

        const previousMembers = members
        setMembers((prev) => prev.map((item) => (item.id === memberId ? { ...item, full_name: fullName, level, role } : item)))

        try {
          const payload: { fullName?: string; level?: string; role?: string } = {}
          if (fullName) payload.fullName = fullName
          if (level) payload.level = level
          payload.role = role

          const updatedProfile = await updateMemberProfile(memberId, payload)
          setMembers((prev) =>
            prev.map((m) =>
              m.id === memberId
                ? {
                    ...m,
                    full_name: updatedProfile?.full_name ?? fullName,
                    level: updatedProfile?.level ?? (level ?? m.level),
                    role: updatedProfile?.role ?? (role ?? m.role),
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
      },
    )
  }

  async function markAttendance(booking: Booking, status: "present" | "absent" | "late") {
    const member = members.find((m) => m.id === booking.user_id)
    const existingRecord = attendanceRecords.find(
      (record) => record.session_id === booking.session_id && record.user_id === booking.user_id,
    )

    const bookingKey = booking.id
    setPendingAttendance((p) => ({ ...p, [bookingKey]: true }))
    const now = new Date().toISOString()

    const nextRecord: AttendanceRecord = {
      id: existingRecord?.id ?? `temp-${Date.now()}`,
      session_id: String(booking.session_id ?? ""),
      user_id: String(booking.user_id ?? ""),
      user_name: member ? String((`${member.first_name ?? ""} ${member.last_name ?? ""}`).trim() || (member.email ?? "")) : "Unknown",
      user_level: String(member?.level ?? "Unknown"),
      status,
      marked_at: now,
      notes: booking.notes ?? existingRecord?.notes ?? null,
    }

    if (existingRecord) {
      setAttendanceRecords((prev) =>
        prev.map((record) => (record.id === existingRecord.id ? { ...record, ...nextRecord, id: record.id } : record)),
      )

      try {
        const response = await fetch("/api/attendance", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendance_id: existingRecord.id, status }),
        })
        const result = await response.json().catch(() => ({}))

        if (!response.ok) {
          setAttendanceRecords((prev) => prev.map((record) => (record.id === existingRecord.id ? existingRecord : record)))
          showToast(`Failed to update attendance: ${result.error ?? "unknown error"}`)
        } else {
          let absenceEmailSent = true
          const session = schedule.find((entry) => String(entry.id) === String(booking.session_id))
          if (status === "absent" && existingRecord.status !== "absent" && member?.email) {
            absenceEmailSent = await sendConfiguredEmail("absence", member.email, {
              memberName: getMemberDisplayName(member),
              sessionTitle: session?.title || String(booking.session_id ?? "session"),
              sessionDate: session?.date || "TBD",
              sessionTime: session?.time || "TBD",
            })
          }
          showToast(absenceEmailSent ? "Attendance updated" : "Attendance updated, but the absence email could not be sent")
        }
      } catch (_err) {
        setAttendanceRecords((prev) => prev.map((record) => (record.id === existingRecord.id ? existingRecord : record)))
        showToast("Network error updating attendance")
      } finally {
        setPendingAttendance((p) => ({ ...p, [bookingKey]: false }))
      }
      return
    }

    setAttendanceRecords((prev) => [...prev, nextRecord])

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: String(booking.session_id ?? ""),
          user_id: String(booking.user_id ?? ""),
          user_name: nextRecord.user_name,
          user_level: nextRecord.user_level,
          status,
          notes: nextRecord.notes,
        }),
      })
      const result = await response.json().catch(() => ({}))

      if (response.ok && result.data) {
        const inserted = result.data as AttendanceRecord
        setAttendanceRecords((prev) => prev.map((r) => (r.id === nextRecord.id ? inserted : r)))
        let absenceEmailSent = true
        if (status === "absent" && member?.email) {
          const session = schedule.find((entry) => String(entry.id) === String(booking.session_id))
          absenceEmailSent = await sendConfiguredEmail("absence", member.email, {
            memberName: getMemberDisplayName(member),
            sessionTitle: session?.title || String(booking.session_id ?? "session"),
            sessionDate: session?.date || "TBD",
            sessionTime: session?.time || "TBD",
          })
        }
        showToast(absenceEmailSent ? "Attendance recorded" : "Attendance recorded, but the absence email could not be sent")
      } else {
        setAttendanceRecords((prev) => prev.filter((r) => r.id !== nextRecord.id))
        showToast(`Failed to save attendance: ${result.error ?? "unknown error"}`)
      }
    } catch (_err) {
      setAttendanceRecords((prev) => prev.filter((r) => r.id !== nextRecord.id))
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
                    {r.notes && <div className="mt-1 text-xs text-amber-300">Note: {r.notes}</div>}
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
          <div className="grid gap-6">
            {latestGeneralAnnouncement && (
              <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                    <Megaphone className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">Latest Announcement</p>
                    <h3 className="mt-2 text-2xl font-bold text-foreground">{latestGeneralAnnouncement.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-foreground/80 whitespace-pre-line">
                      {latestGeneralAnnouncement.content}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Posted {formatDate(latestGeneralAnnouncement.created_at)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {latestFeatureAnnouncement && (
              <Card className="p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/25">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                    <Megaphone className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">Website Feature Update</p>
                    <h3 className="mt-2 text-2xl font-bold text-foreground">{latestFeatureAnnouncement.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-foreground/80 whitespace-pre-line">
                      {latestFeatureAnnouncement.content}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Posted {formatDate(latestFeatureAnnouncement.created_at)}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {active === "members" && (
        <div>
          <SectionHeader title="Members" desc="View members and update account names and skill levels." />

          <div className="mb-4">
            <Label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground">Search Members</Label>
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search by name, email, role, or level..."
              className="max-w-md"
            />
          </div>

          <div className="flex flex-col gap-3">
            {members
              .filter((m) => {
                const query = memberSearch.trim().toLowerCase()
                if (!query) return true

                const searchableText = [
                  m.first_name,
                  m.last_name,
                  m.full_name,
                  m.email,
                  m.role,
                  m.level,
                  `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase()

                return searchableText.includes(query)
              })
              .map((m) => {
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
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs text-muted-foreground">Role / Level</Label>
                          <Select
                            value={
                              m.role && ["staff", "teacher"].includes(m.role) && ALL_ROLE_AND_TIER_OPTIONS.includes(m.role as (typeof ALL_ROLE_AND_TIER_OPTIONS)[number])
                                ? m.role
                                : m.level && ALL_ROLE_AND_TIER_OPTIONS.includes(m.level as (typeof ALL_ROLE_AND_TIER_OPTIONS)[number])
                                  ? m.level
                                  : "Bronze"
                            }
                            onChange={(e) => {
                              const nextValue = e.target.value
                              setMembers((prev) =>
                                prev.map((x) =>
                                  x.id === m.id
                                    ? ROLES.includes(nextValue as Profile["role"])
                                      ? { ...x, role: nextValue as Profile["role"], level: null }
                                      : { ...x, role: "member", level: nextValue }
                                    : x,
                                ),
                              )
                            }}
                            className="h-9 w-40"
                          >
                            {ALL_ROLE_AND_TIER_OPTIONS.map((entry) => (
                              <option key={entry} value={entry}>{entry}</option>
                            ))}
                          </Select>
                        </div>
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

            {members.filter((m) => {
              const query = memberSearch.trim().toLowerCase()
              if (!query) return true
              const searchableText = [
                m.first_name,
                m.last_name,
                m.full_name,
                m.email,
                m.role,
                m.level,
                `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
              return searchableText.includes(query)
            }).length === 0 && memberSearch.trim() && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No members match this keyword.
              </Card>
            )}
          </div>
        </div>
      )}

      {active === "schedule" && (
        <div>
          <SectionHeader title="Schedule Management" desc="Create structured, multi-tier crossing sessions visible only to qualifying members." />
          <ScheduleForm
            teachers={members.filter((member) => member.role === "teacher")}
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
              if (data && data[0]) {
                const createdSession = data[0] as ScheduleSession
                setSchedule((prev) => sortSessions([...prev, createdSession]))
                await Promise.all(
                  members
                    .filter((member) => member.email && member.role !== "staff" && member.role !== "teacher" && member.session_alert_emails !== false)
                    .map((member) => sendConfiguredEmail("session_alert", member.email!, {
                      sessionTitle: createdSession.title || "New session",
                      sessionDate: createdSession.date || "TBD",
                      sessionTime: createdSession.time || "TBD",
                    }))
                )
              }
            }}
          />
          <div className="mt-6 flex flex-col gap-3">
            {schedule.map((s) => (
              <Card key={s.id} className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="font-semibold text-foreground">{s.title ?? "Untitled Session"}</h4>
                    <p className="text-sm font-medium text-muted-foreground mt-0.5">
                      {formatDate(s.date)} · <span>{s.time ?? "TBD"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <EditScheduleButton session={s} onSave={(updates) => updateScheduleItem(s.id, updates)} />
                  <Button size="sm" variant="outline" onClick={() => confirmDelete("schedule item", async () => { await deleteScheduleItem(s.id) })} className="text-xs">
                    Delete
                  </Button>
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
              (() => {
                const sortedSessions = schedule
                  .filter((session) => !isSessionEnded(session))
                  .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
                return sortedSessions.map((session) => {
                  const sessionBookings = bookings
                    .filter((b) => b.session_id === session.id)
                    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
                  const bookedMembers = sessionBookings.map((b) => {
                    const member = members.find((m) => m.id === b.user_id)
                    return { booking: b, member }
                  })
                  const teacherBookings = bookedMembers.filter(({ member }) => member?.role === "teacher")
                  const memberBookings = bookedMembers.filter(({ member }) => member?.role !== "teacher")

                  const tierText = (() => {
                    const tiers = [session.max_level].filter((value): value is string => Boolean(value && value.trim()))
                    if (tiers.length === 0) return "No tier restrictions"
                    return tiers[0]
                  })()

                  return (
                    <Card key={session.id} className="p-4">
                      <div className="mb-3">
                        <h4 className="font-semibold text-foreground">{session.title ?? "Untitled Session"}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(session.date)} · {session.time ?? "TBD"} • Tiers: {tierText}
                        </p>
                      </div>
                      {bookedMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No bookings yet</p>
                      ) : (
                        <div className="space-y-4">
                          {[{ label: "Teacher Bookings", items: teacherBookings }, { label: "Member Bookings", items: memberBookings }]
                            .filter(({ items }) => items.length > 0)
                            .map(({ label, items }) => (
                              <div key={label} className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  {label} · {items.length} Booked
                                </p>
                                {items.map(({ booking, member }) => (
                            <div
                              key={booking.id}
                              className="rounded-md bg-muted/50 p-2.5 text-sm"
                            >
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">
                                    {member?.full_name || member?.email || "Unknown Member"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Email: {member?.email || "N/A"}</p>
                                  <p className="text-xs text-muted-foreground">Level: {member?.level || "N/A"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Booked at: {booking.created_at ? new Date(booking.created_at).toLocaleString() : "N/A"}
                                  </p>
                                  {booking.notes && (
                                    <p className="text-xs text-red-600 dark:text-red-300">Note: {booking.notes}</p>
                                  )}
                                </div>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs border-white bg-white text-black hover:bg-zinc-100"
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
                                ))}
                              </div>
                            ))}
                        </div>
                      )}
                    </Card>
                  )
                })
              })()
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

          <div className="mb-4 grid gap-3 md:grid-cols-5">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Day</Label>
              <Select value={attendanceDayFilter} onChange={(e) => setAttendanceDayFilter(e.target.value as AttendanceDayFilter)}>
                {ATTENDANCE_DAY_FILTERS.map((day) => (
                  <option key={day} value={day}>{day === "all" ? "All Days" : day}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Month</Label>
              <Select value={attendanceMonthFilter} onChange={(e) => setAttendanceMonthFilter(e.target.value as AttendanceMonthFilter)}>
                {ATTENDANCE_MONTH_FILTERS.map((month) => (
                  <option key={month} value={month}>{month === "all" ? "All Months" : month}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Tier</Label>
              <Select value={attendanceTierFilter} onChange={(e) => setAttendanceTierFilter(e.target.value)}>
                <option value="all">All Tiers</option>
                {LEVELS.map((tier) => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Date</Label>
              <Input
                type="date"
                value={attendanceDateFilter === "all" ? "" : attendanceDateFilter}
                onChange={(e) => setAttendanceDateFilter(e.target.value || "all")}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setAttendanceDayFilter("all")
                  setAttendanceMonthFilter("all")
                  setAttendanceTierFilter("all")
                  setAttendanceDateFilter("all")
                  setSelectedMemberFilter(null)
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Member Filter */}
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

          {/* BY SESSION VIEW */}
          {attendanceViewMode === "by-session" && (
            <>
              {schedule.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">No sessions available to mark attendance.</p>
                </Card>
              ) : (
                schedule.filter((session) => !isSessionEnded(session)).map((session) => {
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
                    .filter((row) => {
                      const matchesStatus = attendanceFilter === "all" || row.status === attendanceFilter
                      const matchesMember = selectedMemberFilter === null || row.booking.user_id === selectedMemberFilter
                      const matchesDay = attendanceDayFilter === "all" || getWeekdayLabel(session.date) === attendanceDayFilter
                      const matchesMonth = attendanceMonthFilter === "all" || getMonthLabel(session.date) === attendanceMonthFilter
                      const matchesTier = attendanceTierFilter === "all" || row.member?.level === attendanceTierFilter
                      const matchesDate = attendanceDateFilter === "all" || session.date === attendanceDateFilter
                      return matchesStatus && matchesMember && matchesDay && matchesMonth && matchesTier && matchesDate
                    })

                  return (
                    <Card key={session.id} className="p-4 mb-4">
                      <div className="mb-3">
                        <h4 className="font-semibold text-foreground">{session.title ?? "Untitled Session"}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(session.date)} · {session.time ?? "TBD"} · {getWeekdayLabel(session.date)}
                        </p>
                      </div>
                      <div className="mb-3 flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const toSave = rows.filter((row) => {
                              const booking = row.booking
                              const desired = attendanceSelection[booking.id] ?? "present"
                              const current = row.attendance?.status ?? "not marked"
                              return desired !== current
                            })

                            if (toSave.length === 0) {
                              showToast("No attendance changes to save")
                              return
                            }

                            showConfirmation(
                              "Save attendance?",
                              `Save ${toSave.length} attendance change${toSave.length > 1 ? "s" : ""} for this session?`,
                              async () => {
                                closeConfirmation()
                                for (const row of toSave) {
                                  const booking = row.booking
                                  const desired = attendanceSelection[booking.id] ?? "present"
                                  await markAttendance(booking, desired)
                                }
                                showToast("Attendance saved")
                              },
                            )
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
                                <th className="px-4 py-3">Session</th>
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
                                  <td className="px-4 py-3 align-top text-xs text-zinc-300">
                                    <div className="font-medium text-zinc-100">{session.title ?? "Untitled Session"}</div>
                                    <div className="text-zinc-400">{formatDate(session.date)}</div>
                                  </td>
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
                                            checked={(attendanceSelection[booking.id] ?? (attendance?.status ?? "present")) === opt}
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
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3">Marked At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {attendanceRecords
                        .filter((r) => {
                          const session = schedule.find((s) => s.id === r.session_id)
                          const member = members.find((m) => m.id === r.user_id)
                          const matchesStatus = attendanceFilter === "all" || r.status === attendanceFilter
                          const matchesMember = selectedMemberFilter === null || r.user_id === selectedMemberFilter
                          const matchesDay = attendanceDayFilter === "all" || getWeekdayLabel(session?.date) === attendanceDayFilter
                          const matchesMonth = attendanceMonthFilter === "all" || getMonthLabel(session?.date) === attendanceMonthFilter
                          const matchesTier = attendanceTierFilter === "all" || member?.level === attendanceTierFilter
                          const matchesDate = attendanceDateFilter === "all" || session?.date === attendanceDateFilter
                          return matchesStatus && matchesMember && matchesDay && matchesMonth && matchesTier && matchesDate
                        })
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
                              <td className="px-4 py-3 text-xs text-zinc-400">
                                {record.notes?.trim() || "—"}
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
                        onClick={() => confirmDelete("resource", async () => { await deleteResource(resource.id) })}
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

      {active === "email-templates" && (
        <div className="space-y-6">
          <SectionHeader title="Auto Email Templates" desc="Customize the message content for each automatic email type. These are the templates used for live club communication." />
          <EmailTemplatesEditor
            value={emailTemplates}
            onChange={setEmailTemplates}
            onSave={(nextConfig) => {
              saveEmailTemplateConfig(nextConfig)
              setEmailTemplates(nextConfig)
              showToast("Auto email templates saved")
            }}
          />
        </div>
      )}

      {active === "announcements" && (
        <div className="space-y-6">
          <SectionHeader title="Announcements" desc="Post global updates for your student body dashboard." />

          <Card className="p-5 border-dashed border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              <Megaphone className="h-4 w-4" />
              Website Feature Update
            </div>
            <div className="flex flex-col gap-3">
              <Textarea
                value={websiteFeatureText}
                onChange={(e) => setWebsiteFeatureText(e.target.value)}
                className="min-h-28"
                placeholder="Write the website feature update, such as a new tool, dashboard improvement, or release note..."
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    showConfirmation(
                      "Hide website feature announcement?",
                      "This will hide the current website feature announcement from the dashboard until you post a new one.",
                      async () => {
                        closeConfirmation()
                        await hideLatestAnnouncement(true)
                      },
                    )
                  }}
                  className="border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-900"
                >
                  No Website Feature
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!websiteFeatureText.trim()) return
                    const { data, error } = await supabase
                      .from("announcements")
                      .insert({
                        title: "Website Feature Update",
                        content: websiteFeatureText.trim(),
                      })
                      .select()

                    if (error) {
                      alert(`Announcement DB Error: ${error.message} (${error.code})`)
                      console.error("Full Error Details:", error)
                      return
                    }

                    if (data && data[0]) {
                      setAnnouncements((prev) => [data[0] as Announcement, ...prev])
                      setShowNoFeatureAnnouncement(false)
                      setWebsiteFeatureText("")
                      await Promise.all(
                        members
                          .filter((member) => member.email && member.role !== "staff" && member.role !== "teacher" && member.session_alert_emails !== false)
                          .map((member) => sendConfiguredEmail("announcement", member.email!, { title: "Website Feature Update", content: websiteFeatureText.trim() }))
                      )
                      showToast("✓ Website feature update posted")
                    }
                  }}
                  className="bg-[#40938c] text-black font-bold"
                >
                  Post Website Feature
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                showConfirmation(
                  "Hide regular announcement?",
                  "This will hide the current regular announcement from the dashboard until you post a new one.",
                  async () => {
                    closeConfirmation()
                    await hideLatestAnnouncement(false)
                  },
                )
              }}
              className="border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-900"
            >
              No Announcement
            </Button>
          </div>

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
              if (data && data[0]) {
                setAnnouncements((prev) => [data[0] as Announcement, ...prev])
                setShowNoAnnouncement(false)
                await Promise.all(
                  members
                    .filter((member) => member.email && member.role !== "staff" && member.role !== "teacher" && member.session_alert_emails !== false)
                    .map((member) => sendConfiguredEmail("announcement", member.email!, { title, content }))
                )
              }
            }}
          />

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Announcement Record</h3>
              <Input
                value={announcementSearch}
                onChange={(e) => setAnnouncementSearch(e.target.value)}
                placeholder="Search announcements"
                className="max-w-xs"
              />
            </div>
            {(() => {
              const announcementItems: Announcement[] = Array.isArray(announcements) ? announcements : []
              const normalizedSearch = announcementSearch.trim().toLowerCase()
              const filteredAnnouncements = announcementItems
                .filter((item: Announcement) => {
                  const title = item.title ?? ""
                  const content = item.content ?? ""
                  return normalizedSearch.length === 0
                    ? true
                    : title.toLowerCase().includes(normalizedSearch) || content.toLowerCase().includes(normalizedSearch)
                })
                .sort((a: Announcement, b: Announcement) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

              return filteredAnnouncements.length === 0 ? (
                <Card className="p-5"><p className="text-sm text-muted-foreground">No announcements found.</p></Card>
              ) : (
                filteredAnnouncements.map((item: Announcement) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{item.title || "Announcement"}</p>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">{formatDate(item.created_at)}</span>
                        </div>
                        <p className="text-sm text-white whitespace-pre-line leading-relaxed">{item.content}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white bg-white text-black hover:bg-zinc-100"
                        onClick={() => confirmDelete("announcement", async () => { await deleteAnnouncementItem(item.id) })}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                ))
              )
            })()}
          </div>
        </div>
      )}

      {active === "shop" && (
        <div>
          <SectionHeader title="Wolves Shop Item Pipeline" desc="List available products into the e-commerce inventory platform matrix." />
          <ShopPostingForm
            onCreate={async (payload) => {
              const { data, error } = await supabase.from("shop_items").insert(payload).select()
              if (error) alert(`Shop DB Error: ${error.message}`)
              if (data && data[0]) {
                setShopItems((prev) => [data[0] as ShopItem, ...prev])
                await Promise.all(
                  members
                    .filter((member) => member.email && member.marketing_emails !== false)
                    .map((member) => sendConfiguredEmail("shop_update", member.email!, { itemName: data[0].name || "a new shop item" }))
                )
              }
            }}
          />
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Published Shop Items</h3>
            {shopItems.length === 0 ? (
              <Card className="p-5"><p className="text-sm text-muted-foreground">No items published yet.</p></Card>
            ) : (
              <div className="space-y-3">
                {shopItems.map((item) => {
                  const imageUrls = parseImageUrls(item.pic_url || (item.image_urls ? JSON.stringify(item.image_urls) : null))
                  const firstImage = imageUrls[0]
                  return (
                    <Card key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted/30">
                          {firstImage ? (
                            <img src={firstImage} alt={item.name ?? "Shop item"} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-zinc-500">Shop</div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-black">{item.name}</p>
                          <p className="text-xs text-black/70 mt-1">${item.price ?? 0} · {item.category ?? "General"}</p>
                          <p className="mt-1 text-xs text-black/80 whitespace-pre-wrap break-words">{item.description || "No description provided."}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShopStockEditor
                          item={item}
                          onSave={(stock, unit) => updateShopStock(item.id, stock, unit)}
                        />
                        <EditShopItemButton item={item} onSave={(updates) => updateExistingShopItem(item.id, updates)} />
                        <Button size="sm" variant="outline" onClick={() => confirmDelete("shop item", async () => { await deleteShopItem(item.id) })} className="border-white bg-white text-black hover:bg-zinc-100 text-xs">
                          Delete
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
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
              <div className="space-y-3">
                {gearGuides.map((guide) => {
                  const imageUrls = parseImageUrls(guide.image_url ?? (guide.image_urls ? JSON.stringify(guide.image_urls) : null))
                  const firstImage = imageUrls[0]
                  return (
                    <Card key={guide.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted/30">
                          {firstImage ? (
                            <img src={firstImage} alt={guide.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-zinc-500">Guide</div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-black">{guide.title}</p>
                          <p className="text-xs text-black/70 mt-1">{guide.category ?? "Equipment"}</p>
                          <p className="mt-2 text-xs leading-relaxed text-black/80 whitespace-pre-wrap break-words">{guide.description || guide.specs || "No details available."}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <EditGearGuideButton guide={guide} onSave={(updates) => updateExistingGearGuide(guide.id, updates)} />
                        <Button size="sm" variant="outline" onClick={() => confirmDelete("gear guide", async () => { await deleteGearGuide(guide.id) })} className="border-white bg-white text-black hover:bg-zinc-100 text-xs">
                          Delete
                        </Button>
                      </div>
                    </Card>
                  )
                })}
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
            onCreate={async ({ userId, level, feedback, date, score, pdf_url }) => {
              const { data, error } = await supabase
                .from("assessments")
                .insert({ user_id: userId, level, feedback, score, date, pdf_url })
                .select()
              if (error) {
                alert(`Assessment DB Error: ${error.message}`)
                return
              }
              if (data && data[0]) {
                setAssessments((prev) => [data[0] as Assessment, ...prev])
                await supabase.from("profiles").update({ level }).eq("id", userId)
                setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, level } : m)))
                const targetMember = members.find((member) => member.id === userId)
                if (targetMember?.email) {
                  await sendConfiguredEmail("assessment", targetMember.email, {
                    memberName: getMemberDisplayName(targetMember),
                    level,
                  })
                }
              }
            }}
          />
          <div className="mt-6">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h3 className="text-sm font-semibold text-foreground">Published Assessments</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={assessmentSearch}
                  onChange={(e) => setAssessmentSearch(e.target.value)}
                  placeholder="Search name, email, level..."
                  className="w-full sm:w-52"
                />
                <Select value={assessmentTierFilter} onChange={(e) => setAssessmentTierFilter(e.target.value)} className="w-full sm:w-36">
                  <option value="all">All tiers</option>
                  {LEVELS.map((tier) => (
                    <option key={tier} value={tier}>{tier}</option>
                  ))}
                </Select>
              </div>
            </div>
            {assessments.length === 0 ? (
              <Card className="p-5"><p className="text-sm text-muted-foreground">No assessments posted yet.</p></Card>
            ) : (
              <div className="grid gap-4">
                {assessments
                  .filter((assessment) => {
                    const member = members.find((m) => m.id === assessment.user_id)
                    const searchTerm = assessmentSearch.trim().toLowerCase()
                    const matchesTier = assessmentTierFilter === "all" || assessment.level === assessmentTierFilter
                    const matchesSearch = !searchTerm || [
                      assessment.level,
                      assessment.feedback,
                      member?.full_name,
                      member?.email,
                      member?.first_name,
                      member?.last_name,
                    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(searchTerm))
                    return matchesTier && matchesSearch
                  })
                  .map((assessment) => {
                    const member = members.find((m) => m.id === assessment.user_id)
                    return (
                      <Card key={assessment.id} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{assessment.level || "Level"}</p>
                            <p className="text-xs text-muted-foreground">{member ? `${member.full_name || getMemberDisplayName(member)} · ${member.email || "No email"}` : "Member record"}</p>
                            <p className="text-xs text-muted-foreground">{assessment.score ?? 0}/100 · {formatDate(assessment.date)}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => confirmDelete("assessment", async () => { await deleteAssessmentItem(assessment.id) })} className="text-xs border-white bg-white text-black hover:bg-zinc-100">
                            Delete
                          </Button>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-white">{assessment.feedback}</p>
                      </Card>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {active === "comments" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SectionHeader title="Member comments" desc="Review member advice and feedback and update each item to the right status." />
            <div className="flex flex-wrap gap-2">
              {(["all", "unread", "solved"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setCommentFilter(filter)}
                  className={`rounded-sm border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] transition ${commentFilter === filter ? "border-zinc-600 bg-zinc-800 text-white" : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredComments.length === 0 ? (
            <Card className="p-6 text-center text-sm text-white">No comments in this filter.</Card>
          ) : (
            <div className="grid gap-4">
              {filteredComments.map((message) => {
                const normalizedStatus = normalizeCommentStatus(message.status)
                const readableStatus = normalizedStatus === "solved" ? "Solved" : "Unread"
                return (
                  <Card key={message.id} className="p-4 border border-zinc-800 bg-zinc-950/70">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{message.subject || "General advice"}</h3>
                          <Badge className={normalizedStatus === "solved" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : normalizedStatus === "unread" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" : "bg-zinc-700/40 text-white border border-zinc-600"}>
                            {readableStatus}
                          </Badge>
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-200">{getMemberDisplayName(members.find((member) => member.id === message.user_id)) || message.user_email}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateCommentStatus(message.id, "unread")} className="border-zinc-700 bg-zinc-900 text-white">Unread</Button>
                        <Button size="sm" onClick={() => updateCommentStatus(message.id, "solved")} className="bg-[#40938c] text-black">Solved</Button>
                        <Button size="sm" variant="outline" onClick={() => confirmDelete("comment", async () => { await deleteSupportTicketItem(message.id) })} className="border-white bg-white text-black hover:bg-zinc-100">Delete</Button>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-white whitespace-pre-wrap">{message.message}</p>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800 pt-3 text-[10px] uppercase tracking-[0.2em] text-zinc-200">
                      <span>{formatDate(message.created_at)}</span>
                      <span>{message.user_email}</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
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

function EditScheduleButton({
  session,
  onSave,
}: {
  session: ScheduleSession
  onSave: (updates: Partial<ScheduleSession>) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState(session.title ?? "")
  const [date, setDate] = useState(session.date ?? "")
  const [time, setTime] = useState(session.time ?? "")
  const [coach, setCoach] = useState(session.coach ?? "")
  const [notes, setNotes] = useState(session.notes ?? "")
  const [confirmLoading, setConfirmLoading] = useState(false)
  const { toast, showToast } = useToast()

  async function saveSession() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !date) {
      showToast("Please add a title and date before saving.")
      return
    }

    setConfirmLoading(true)
    try {
      await onSave({
        title: trimmedTitle,
        date,
        time,
        coach,
        notes,
      })
      setIsOpen(false)
      showToast("✓ Session saved!")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save session")
    } finally {
      setConfirmLoading(false)
    }
  }

  function submitEditor(e: React.FormEvent) {
    e.preventDefault()
    void saveSession()
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setIsOpen(true)} className="text-xs">
        Edit
      </Button>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg border border-zinc-800 bg-white p-5 text-black shadow-2xl">
            <h3 className="text-base font-semibold">Edit session</h3>
            <form onSubmit={submitEditor} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Title</span><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium"><span>Date</span><Input type="date" value={date ?? ""} onChange={(e) => setDate(e.target.value)} required /></label>
                <label className="flex flex-col gap-1 text-xs font-medium"><span>Time</span><Select value={time} onChange={(e) => setTime(e.target.value)}>
                  <option value="">Select time slot</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </Select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium"><span>Coach</span><Input value={coach} onChange={(e) => setCoach(e.target.value)} /></label>
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Notes</span><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(false)} className="border-black bg-white text-black hover:bg-zinc-100">Cancel</Button>
                <Button type="submit" size="sm" disabled={confirmLoading} className="bg-[#40938c] text-black font-bold">
                  {confirmLoading ? "Saving..." : "Save session"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function ScheduleForm({
  teachers,
  onCreate,
}: {
  teachers: Profile[]
  onCreate: (payload: {
    title: string
    date: string
    time: string
    visibility_tiers: string[]
    coach: string
    notes: string
  }) => Promise<void>
}) {
  const { loading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [selectedTiers, setSelectedTiers] = useState<string[]>([...ALL_TIERS])
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])
  const [notes, setNotes] = useState("")

  const toggleTier = (tier: string) => {
    setSelectedTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    )
  }

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId],
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
            coach: teachers
              .filter((teacher) => selectedTeacherIds.includes(teacher.id))
              .map((teacher) => getMemberDisplayName(teacher))
              .join(", "),
            notes,
          })
          setTitle("")
          setDate("")
          setTime("")
          setSelectedTeacherIds([])
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
            <Label className="text-[#40938c] font-bold">Select Visible Ranks</Label>
            <div className="flex flex-wrap gap-4">
              {ALL_TIERS.map((tier) => (
                <label key={tier} className="flex items-center gap-2 text-xs font-mono text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTiers.includes(tier)}
                  onChange={() => toggleTier(tier)}
                  className="accent-[#40938c] h-4 w-4"
                />
                {tier}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Assign Teacher(s)</Label>
          {teachers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No teacher profiles are available.</p>
          ) : (
            <div className="flex flex-wrap gap-3 rounded border border-zinc-800 bg-zinc-950/40 p-3">
              {teachers.map((teacher) => (
                <label key={teacher.id} className="flex items-center gap-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={selectedTeacherIds.includes(teacher.id)}
                    onChange={() => toggleTeacher(teacher.id)}
                    className="h-4 w-4 accent-[#40938c]"
                  />
                  {getMemberDisplayName(teacher)}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="s-notes">Session Notes</Label>
          <Textarea id="s-notes" placeholder="Constraints description..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading} className="bg-[#40938c] text-black font-bold">
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
  const { loading } = useSubmitting()
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
            <Button type="submit" disabled={loading} className="bg-[#40938c] text-black font-bold">
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

function ShopPostingForm({ onCreate }: { onCreate: (payload: { name: string; category: string; price: number; description: string; specs?: string; pic_url: string; stock: number; unit: string }) => Promise<void> }) {
  const { loading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("Rackets")
  const [price, setPrice] = useState("")
  const [specs, setSpecs] = useState("")
  const [description, setDescription] = useState("")
  const [picUrl, setPicUrl] = useState("")
  const [stock, setStock] = useState(0)
  const [unit, setUnit] = useState("units")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const imageUrls = parseImageUrls(picUrl)
    const firstImage = imageUrls[0] ?? ""
    showConfirmation(
      "Add Shop Item?",
      `List "${name}" for $${Number(price) || 0} in ${category}?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate({
            name,
            category,
            price: Number(price) || 0,
            description,
            specs,
            pic_url: imageUrls.join(", "),
            stock: Number(stock) || 0,
            unit,
          })
          setName("")
          setPrice("")
          setSpecs("")
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
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label>Product Image URLs</Label><Textarea value={picUrl} onChange={(e) => setPicUrl(e.target.value)} placeholder="Add multiple image URLs, separated by commas or new lines" required /></div>
          <div className="flex flex-col gap-1.5"><Label>Stock Quantity</Label><Input type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value))} /></div>
          <div className="flex flex-col gap-1.5"><Label>Unit Label</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="units, set, pack, box" /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label>Specs</Label><Textarea value={specs} onChange={(e) => setSpecs(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label>Overview</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <Button type="submit" disabled={loading} className="sm:col-span-2 bg-[#40938c] text-black font-bold">List Product Stock</Button>
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

function EditShopItemButton({
  item,
  onSave,
}: {
  item: ShopItem
  onSave: (updates: Partial<ShopItem>) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(item.name ?? "")
  const category = item.category ?? "Rackets"
  const [price, setPrice] = useState(String(item.price ?? 0))
  const [description, setDescription] = useState(item.description ?? "")
  const [picUrl, setPicUrl] = useState(item.pic_url ?? "")
  const [stock, setStock] = useState(String(item.stock ?? 0))
  const [unit, setUnit] = useState(item.unit ?? "units")
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()

  async function saveShopItem() {
    const trimmedName = name.trim()
    if (!trimmedName || !price.trim()) {
      showToast("Please add a title and price before saving.")
      return
    }

    setSaving(true)
    try {
      await onSave({
        name: trimmedName,
        category,
        price: Number(price) || 0,
        description,
        pic_url: picUrl,
        stock: Number(stock) || 0,
        unit,
      })
      setIsOpen(false)
      showToast("✓ Shop item saved!")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save shop item")
    } finally {
      setSaving(false)
    }
  }

  function submitEditor(e: React.FormEvent) {
    e.preventDefault()
    void saveShopItem()
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setIsOpen(true)} className="border-white bg-white text-black hover:bg-zinc-100 text-xs">
        Edit details
      </Button>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg border border-zinc-800 bg-white p-5 text-black shadow-2xl">
            <h3 className="text-base font-semibold">Edit shop item</h3>
            <form onSubmit={submitEditor} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Title</span><Input value={name} onChange={(e) => setName(e.target.value)} required /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium"><span>Price</span><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></label>
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Image URL</span><Input value={picUrl} onChange={(e) => setPicUrl(e.target.value)} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium"><span>Stock</span><Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} /></label>
                <label className="flex flex-col gap-1 text-xs font-medium"><span>Unit</span><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></label>
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Overview</span><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(false)} className="border-black bg-white text-black hover:bg-zinc-100">Cancel</Button>
                <Button type="submit" size="sm" disabled={saving} className="bg-[#40938c] text-black font-bold">
                  {saving ? "Saving..." : "Save item"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function ShopStockEditor({
  item,
  onSave,
}: {
  item: ShopItem
  onSave: (stock: number, unit: string) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [stock, setStock] = useState(String(item.stock ?? 0))
  const [unit, setUnit] = useState(item.unit || "units")
  const [confirmLoading, setConfirmLoading] = useState(false)
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()

  function openEditor() {
    setStock(String(item.stock ?? 0))
    setUnit(item.unit || "units")
    setIsOpen(true)
  }

  function submitEditor(e: React.FormEvent) {
    e.preventDefault()
    const nextStock = Math.max(0, Number(stock) || 0)
    const nextUnit = unit.trim() || "units"

    showConfirmation(
      "Update shop stock?",
      `Set ${item.name || "this item"} to ${nextStock} ${nextUnit}?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onSave(nextStock, nextUnit)
          setIsOpen(false)
          showToast("✓ Shop stock updated!")
        } catch (error) {
          alert(error instanceof Error ? error.message : "Unable to update shop stock")
        } finally {
          setConfirmLoading(false)
        }
      },
    )
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={openEditor} className="border-white bg-white text-black hover:bg-zinc-100 text-xs">
        Change stock / unit
      </Button>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm border border-zinc-800 bg-white p-5 text-black shadow-2xl">
            <h3 className="text-base font-semibold">Change stock / unit</h3>
            <p className="mt-1 text-xs text-black/70">{item.name || "Shop item"}</p>
            <form onSubmit={submitEditor} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Stock quantity
                <Input type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Unit label
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="units, set, pack, box" required />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(false)} className="border-black bg-white text-black hover:bg-zinc-100">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#40938c] text-black font-bold">
                  Review change
                </Button>
              </div>
            </form>
          </Card>
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
    </>
  )
}

function EditGearGuideButton({
  guide,
  onSave,
}: {
  guide: EquipmentRecommendation
  onSave: (updates: Partial<EquipmentRecommendation>) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState(guide.title ?? "")
  const category = guide.category ?? ""
  const [specs, setSpecs] = useState(guide.specs ?? "")
  const [description, setDescription] = useState(guide.description ?? "")
  const [recommendedForTier, setRecommendedForTier] = useState(guide.recommended_for_tier ?? "")
  const [link, setLink] = useState(guide.link ?? "")
  const [imageUrl, setImageUrl] = useState(guide.image_url ?? "")
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()

  async function saveGuide() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      showToast("Please add a title before saving.")
      return
    }

    setSaving(true)
    try {
      await onSave({
        title: trimmedTitle,
        category,
        specs,
        description,
        recommended_for_tier: recommendedForTier,
        link,
        image_url: imageUrl,
      })
      setIsOpen(false)
      showToast("✓ Gear guide saved!")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save gear guide")
    } finally {
      setSaving(false)
    }
  }

  function submitEditor(e: React.FormEvent) {
    e.preventDefault()
    void saveGuide()
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setIsOpen(true)} className="border-white bg-white text-black hover:bg-zinc-100 text-xs">
        Edit details
      </Button>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg border border-zinc-800 bg-white p-5 text-black shadow-2xl">
            <h3 className="text-base font-semibold">Edit gear guide</h3>
            <form onSubmit={submitEditor} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Title</span><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Recommended for tier</span><Input value={recommendedForTier} onChange={(e) => setRecommendedForTier(e.target.value)} /></label>
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Image URL</span><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></label>
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Product link</span><Input value={link} onChange={(e) => setLink(e.target.value)} /></label>
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Specs</span><Textarea value={specs} onChange={(e) => setSpecs(e.target.value)} /></label>
              <label className="flex flex-col gap-1 text-xs font-medium"><span>Overview</span><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(false)} className="border-black bg-white text-black hover:bg-zinc-100">Cancel</Button>
                <Button type="submit" size="sm" disabled={saving} className="bg-[#40938c] text-black font-bold">
                  {saving ? "Saving..." : "Save guide"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      <Toast isOpen={toast.isOpen} message={toast.message} />
    </>
  )
}

function EquipmentGuideForm({ onCreate }: { onCreate: (payload: { title: string; category: string; description: string; image_url: string; recommended_for_tier: string; specs: string }) => Promise<void> }) {
  const { loading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("Rackets")
  const [specs, setSpecs] = useState("")
  const [description, setDescription] = useState("")
  const [picUrl, setPicUrl] = useState("")
  const [recommendedTiers, setRecommendedTiers] = useState<string[]>(["Beginner"])
  const [priceEstimate, setPriceEstimate] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const imageUrls = parseImageUrls(picUrl)
    const joinedUrls = imageUrls.join(", ")
    showConfirmation(
      "Publish Equipment Guide?",
      `Publish "${title}" guide for ${category} (${recommendedTiers.join(", ")})?`,
      async () => {
        setConfirmLoading(true)
        try {
          const formattedSpecs = [specs.trim(), priceEstimate ? `Estimated price: $${Number(priceEstimate).toFixed(2)}` : ""].filter(Boolean).join("\n")
          const recommended_for_tier = recommendedTiers.join(", ")
          await onCreate({ title, category, description, image_url: joinedUrls, recommended_for_tier, specs: formattedSpecs })
          setTitle("")
          setSpecs("")
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2"><Label>Image URLs (comma- or line-separated)</Label><Textarea value={picUrl} onChange={(e) => setPicUrl(e.target.value)} placeholder="https://...jpg, https://...jpg, https://...jpg" required /></div>
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
          <div className="flex flex-col gap-1.5"><Label>Specs</Label><Textarea value={specs} onChange={(e) => setSpecs(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label>Overview</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
          <Button type="submit" disabled={loading} className="bg-[#40938c] text-black font-bold">Publish Review Guide</Button>
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
  onCreate: (payload: { userId: string; level: string; feedback: string; date: string; score: number; pdf_url?: string | null }) => Promise<void>
}) {
  const { loading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState("")
  const [level, setLevel] = useState<string>(ALL_TIERS[0])
  const [score, setScore] = useState<number>(80)
  const [scoreInput, setScoreInput] = useState<string>("80")
  const [feedback, setFeedback] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const selectedMember = members.find((m) => m.id === userId)
  const memberName = selectedMember 
    ? `${selectedMember.first_name ?? ""} ${selectedMember.last_name ?? ""}`.trim() || selectedMember.email
    : "Member"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    let pdfUrl: string | null = null

    if (pdfFile) {
      const fileIsPdf = pdfFile.type === "application/pdf" || pdfFile.name.toLowerCase().endsWith(".pdf")
      if (!fileIsPdf) {
        showToast("Please upload a PDF file for the assessment.")
        return
      }

      try {
        const formData = new FormData()
        formData.append("file", pdfFile)

        const uploadRes = await fetch("/api/support/upload", {
          method: "POST",
          body: formData,
        })
        const uploadJson = await uploadRes.json()

        if (!uploadRes.ok || !uploadJson?.data?.publicUrl) {
          throw new Error(uploadJson?.error || "PDF upload failed")
        }

        pdfUrl = uploadJson.data.publicUrl
      } catch (error) {
        console.error("Assessment PDF upload failed:", error)
        showToast(error instanceof Error ? error.message : "Assessment PDF upload failed")
        return
      }
    }
    
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
            pdf_url: pdfUrl,
          })
          setFeedback("")
          setPdfFile(null)
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
              {ALL_TIERS.map((l) => (
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
                step="0.1"
                value={score}
                onChange={(e) => {
                  const nextValue = Number(e.target.value)
                  setScore(Number.isFinite(nextValue) ? nextValue : 0)
                  setScoreInput(String(nextValue))
                }}
                className="w-full h-8 accent-[#40938c]"
              />
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={scoreInput}
                onChange={(e) => {
                  const raw = e.target.value
                  setScoreInput(raw)

                  if (raw === "") {
                    setScore(0)
                    return
                  }

                  const nextValue = Number(raw)
                  if (!Number.isFinite(nextValue)) return

                  const clamped = Math.min(100, Math.max(0, nextValue))
                  setScore(clamped)
                  setScoreInput(raw)
                }}
                className="w-20 text-right"
              />
              <span className="w-10 text-right text-sm font-semibold">%</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Feedback</Label>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback..." className="min-h-28" required />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Assessment PDF (optional)</Label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-3 file:rounded-sm file:border-0 file:bg-[#40938c] file:text-black file:font-bold file:text-[10px] file:uppercase file:tracking-[0.18em]"
            />
            {pdfFile && <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Selected: {pdfFile.name}</p>}
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={loading} className="bg-[#40938c] text-black font-bold">
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

function EmailTemplatesEditor({
  value,
  onChange,
  onSave,
}: {
  value: EmailTemplateConfig
  onChange: (next: EmailTemplateConfig) => void
  onSave: (next: EmailTemplateConfig) => void
}) {
  const { showConfirmation, closeConfirmation, confirmState } = useConfirmation()
  const [saving, setSaving] = useState(false)

  const onSaveClick = () => {
    showConfirmation(
      "Save email templates?",
      "This updates the auto-email text used for reminders, announcements, assessments, and shop updates.",
      async () => {
        closeConfirmation()
        setSaving(true)
        try {
          onSave(value)
        } finally {
          setSaving(false)
        }
      },
    )
  }

  const templateEntries = [
    { key: "booking_confirmation", label: "Booking confirmation" },
    { key: "booking_reminder", label: "Booking reminder" },
    { key: "announcement", label: "Announcement" },
    { key: "session_alert", label: "New session alert" },
    { key: "assessment", label: "Assessment" },
    { key: "absence", label: "Absence notice" },
    { key: "shop_update", label: "Shop update" },
  ] as const

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Automatic email content</h3>
            <p className="text-xs text-muted-foreground">Use placeholders like {'{memberName}'}, {'{sessionTitle}'}, {'{sessionDate}'}, {'{sessionTime}'}, {'{title}'}, {'{content}'}, {'{level}'}, {'{itemName}'}</p>
          </div>
          <Button type="button" onClick={onSaveClick} disabled={saving} className="bg-[#40938c] text-black font-bold">
            {saving ? "Saving..." : "Save all templates"}
          </Button>
        </div>

        <div className="space-y-5">
          {templateEntries.map(({ key, label }) => (
            <Card key={key} className="border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-foreground">{label}</h4>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="mb-1 block text-xs uppercase tracking-[0.2em] text-muted-foreground">Subject</Label>
                  <Input
                    value={value[key].subject}
                    onChange={(event) => onChange({
                      ...value,
                      [key]: { ...value[key], subject: event.target.value },
                    })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs uppercase tracking-[0.2em] text-muted-foreground">Body</Label>
                  <Textarea
                    value={value[key].body}
                    onChange={(event) => onChange({
                      ...value,
                      [key]: { ...value[key], body: event.target.value },
                    })}
                    className="min-h-32"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <ConfirmationDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isLoading={false}
        onConfirm={() => confirmState.onConfirm()}
        onCancel={closeConfirmation}
      />
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

  const showConfirmation = (title: string, message: string, onConfirm: () => Promise<void> | void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }))
        await onConfirm()
      },
    })
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
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  isLoading: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 border border-black bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-black">{title}</h2>
        <p className="mt-3 text-sm text-black/80">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="border border-black bg-white px-4 text-black hover:bg-zinc-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void onConfirm()
            }}
            disabled={isLoading}
            className="border border-black bg-white px-4 text-black hover:bg-zinc-100"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-black" />
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