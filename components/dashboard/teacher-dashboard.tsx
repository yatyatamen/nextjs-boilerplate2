"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DashboardShell, type NavItem } from "@/components/dashboard/shell"
import { Badge, Button, Card, Input, Textarea } from "@/components/ui/primitives"
import type {
  Announcement,
  AttendanceRecord,
  Booking,
  Profile,
  ScheduleSession,
} from "@/lib/types"
import { LEVELS } from "@/lib/types"
import {
  CalendarDays,
  CheckCircle,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Moon,
  Settings,
  Sun,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react"

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "My Bookings", icon: Ticket },
  { key: "attendance", label: "Attendance", icon: UserCheck },
  { key: "leaders", label: "Our Leaders", icon: Users },
  { key: "support", label: "Contact & Support", icon: LifeBuoy },
  { key: "settings", label: "Settings", icon: Settings },
]

const AVAILABLE_TIME_SLOTS = [
  "3:20-4:30 PM",
  "3:20-4:45 PM",
  "3:20-5:00 PM",
  "3:20-5:15 PM",
]

const PLAYER_TIERS = LEVELS

function formatDate(date: string | null) {
  if (!date) return "TBD"
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const d = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function isFeatureAnnouncement(title: string | null | undefined) {
  const normalized = String(title ?? "").toLowerCase()
  return normalized.includes("website") || normalized.includes("feature")
}

export function TeacherDashboard({
  profile,
  initialMembers,
  initialSchedule,
  initialAnnouncements,
  initialBookings,
  initialAttendanceRecords,
  initialLeaders,
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialBookings: Booking[]
  initialAttendanceRecords?: AttendanceRecord[]
  initialLeaders: { id: string; name: string; role_title: string; bio: string | null; specialties: string[]; avatar_url: string | null }[]
}) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")
  const [members] = useState(initialMembers)
  const [schedule, setSchedule] = useState(initialSchedule)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [bookings, setBookings] = useState(initialBookings)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialAttendanceRecords ?? [])
  const [newSessionDate, setNewSessionDate] = useState("")
  const [newSessionTime, setNewSessionTime] = useState(AVAILABLE_TIME_SLOTS[0])
  const [newSessionLevel, setNewSessionLevel] = useState<string>(PLAYER_TIERS[0])
  const [newSessionTitle, setNewSessionTitle] = useState("")
  const [newSessionNotes, setNewSessionNotes] = useState("")
  const [supportCategory, setSupportCategory] = useState("Advice / Feedback")
  const [supportMessage, setSupportMessage] = useState("")
  const [supportStatus, setSupportStatus] = useState<string | null>(null)
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "present" | "absent" | "late">("all")
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [customName, setCustomName] = useState(profile.full_name || "")

  const displayName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email || "Teacher"
  const latestGeneralAnnouncement = [...announcements]
    .filter((item) => !isFeatureAnnouncement(item.title))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const latestFeatureAnnouncement = [...announcements]
    .filter((item) => isFeatureAnnouncement(item.title))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  const filteredAttendance = attendanceRecords.filter((record) => {
    if (attendanceFilter === "all") return true
    return record.status === attendanceFilter
  })

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!newSessionTitle.trim() || !newSessionDate) return

    const payload = {
      title: newSessionTitle.trim(),
      date: newSessionDate,
      time: newSessionTime,
      min_level: newSessionLevel,
      max_level: newSessionLevel,
      coach: profile.full_name || profile.first_name || "Teacher",
      notes: newSessionNotes.trim(),
    }

    const { data, error } = await supabase.from("schedule").insert(payload).select()
    if (error) {
      alert(`Schedule DB Error: ${error.message}`)
      return
    }

    if (data && data[0]) {
      setSchedule((prev) => [data[0] as ScheduleSession, ...prev])
      setNewSessionTitle("")
      setNewSessionDate("")
      setNewSessionTime(AVAILABLE_TIME_SLOTS[0])
      setNewSessionLevel(PLAYER_TIERS[0])
      setNewSessionNotes("")
    }
  }

  async function handleDeleteSchedule(id: string) {
    const { error } = await supabase.from("schedule").delete().eq("id", id)
    if (error) {
      alert(`Schedule delete failed: ${error.message}`)
      return
    }
    setSchedule((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleSubmitSupportTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!supportMessage.trim()) return

    const { error } = await supabase.from("support_tickets").insert({
      user_id: profile.id,
      title: supportCategory,
      message: supportMessage.trim(),
      status: "new",
      sender_name: displayName,
    })

    if (error) {
      setSupportStatus(`Error: ${error.message}`)
      return
    }

    setSupportStatus("Success: Your comment was submitted.")
    setSupportMessage("")
    setSupportCategory("Advice / Feedback")
  }

  async function markAttendance(booking: Booking, status: "present" | "absent" | "late") {
    const member = members.find((candidate) => candidate.id === booking.user_id)
    const existing = attendanceRecords.find((record) => record.session_id === booking.session_id && record.user_id === booking.user_id)
    const now = new Date().toISOString()

    if (existing) {
      const { error } = await supabase.from("attendance").update({ status, marked_at: now }).eq("id", existing.id)
      if (!error) {
        setAttendanceRecords((prev) => prev.map((record) => record.id === existing.id ? { ...record, status, marked_at: now } : record))
      }
      return
    }

    const { data, error } = await supabase
      .from("attendance")
      .insert([
        {
          session_id: String(booking.session_id ?? ""),
          user_id: String(booking.user_id ?? ""),
          user_name: member ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.email || "Unknown" : "Unknown",
          user_level: member?.level ?? "Unknown",
          status,
          marked_at: now,
        },
      ])
      .select()

    if (!error && data && data[0]) {
      setAttendanceRecords((prev) => [...prev, data[0] as AttendanceRecord])
    }
  }

  const theme = {
    textSecondary: isDarkMode ? "text-zinc-400" : "text-zinc-600",
    textMuted: isDarkMode ? "text-zinc-500" : "text-zinc-600",
    cardBg: isDarkMode ? "bg-zinc-900/70" : "bg-white",
    cardBorder: isDarkMode ? "border-zinc-800" : "border-zinc-200",
    headingColor: isDarkMode ? "text-zinc-100" : "text-zinc-900",
    inputBg: isDarkMode ? "bg-zinc-950/60 border-zinc-700 text-zinc-100" : "bg-white border-zinc-300 text-zinc-900",
  }

  const scheduleById = new Map<string, ScheduleSession>()
  schedule.forEach((session) => scheduleById.set(String(session.id), session))

  return (
    <DashboardShell
      navItems={NAV}
      activeKey={active}
      onChange={setActive}
      displayName={displayName}
      subtitle={profile.email ?? ""}
      badgeLabel="Teacher"
    >
      {active === "overview" && (
        <div className="flex flex-col gap-6">
          <Card className={`overflow-hidden border ${theme.cardBorder} ${theme.cardBg}`}>
            <div className="bg-[#40938c] p-6 text-black">
              <p className="text-sm font-medium opacity-80">Teacher console</p>
              <h2 className="mt-2 text-2xl font-bold">Welcome, {displayName}</h2>
              <p className="mt-1 text-sm opacity-80">
                Review sessions, member progress, club updates, and upcoming coaching activity.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Card className={`flex items-center gap-3 p-4 ${theme.cardBorder} ${theme.cardBg}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#40938c]/15 text-[#40938c]">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground">{members.length}</p>
                <p className="text-xs text-muted-foreground">Members</p>
              </div>
            </Card>

            <Card className={`flex items-center gap-3 p-4 ${theme.cardBorder} ${theme.cardBg}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#40938c]/15 text-[#40938c]">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground">{schedule.length}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
            </Card>

            <Card className={`flex items-center gap-3 p-4 ${theme.cardBorder} ${theme.cardBg}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#40938c]/15 text-[#40938c]">
                <Ticket className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-foreground">{bookings.length}</p>
                <p className="text-xs text-muted-foreground">Bookings</p>
              </div>
            </Card>
          </div>

          {latestGeneralAnnouncement && (
            <Card className={`p-6 border ${theme.cardBorder} ${theme.cardBg}`}>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#40938c]/15 text-[#40938c]">
                  <Megaphone className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#40938c]">Latest Announcement</p>
                  <h3 className={`mt-2 text-2xl font-bold ${theme.headingColor}`}>{latestGeneralAnnouncement.title}</h3>
                  <p className={`mt-3 text-base leading-relaxed whitespace-pre-line ${theme.textSecondary}`}>
                    {latestGeneralAnnouncement.content}
                  </p>
                  <p className={`mt-3 text-xs ${theme.textMuted}`}>Posted {formatDate(latestGeneralAnnouncement.created_at)}</p>
                </div>
              </div>
            </Card>
          )}

          {latestFeatureAnnouncement && (
            <Card className="border border-[#40938c]/30 bg-[#40938c]/5 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#40938c]/15 text-[#40938c]">
                  <Megaphone className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#40938c]">Website Feature Update</p>
                  <h3 className={`mt-2 text-2xl font-bold ${theme.headingColor}`}>{latestFeatureAnnouncement.title}</h3>
                  <p className={`mt-3 text-base leading-relaxed whitespace-pre-line ${theme.textSecondary}`}>
                    {latestFeatureAnnouncement.content}
                  </p>
                  <p className={`mt-3 text-xs ${theme.textMuted}`}>Posted {formatDate(latestFeatureAnnouncement.created_at)}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {active === "schedule" && (
        <div>
          <div className="mb-4">
            <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Session Schedule</h2>
          </div>

          <Card className={`mb-4 flex flex-col gap-3 border p-4 ${theme.cardBorder} ${theme.cardBg}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#40938c]">Create New Schedule Track</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className={`rounded-sm border px-2 py-1.5 text-xs ${theme.inputBg}`} />
              <select value={newSessionTime} onChange={(e) => setNewSessionTime(e.target.value)} className={`rounded-sm border px-2 py-1.5 text-xs ${theme.inputBg}`}>
                {AVAILABLE_TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
              <select value={newSessionLevel} onChange={(e) => setNewSessionLevel(e.target.value)} className={`rounded-sm border px-2 py-1.5 text-xs ${theme.inputBg}`}>
                {PLAYER_TIERS.map((tier) => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`text-[10px] font-mono uppercase ${theme.textSecondary}`}>Session title</label>
              <input value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} placeholder="Training context title" className={`rounded-sm border px-2 py-1.5 text-xs ${theme.inputBg}`} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`text-[10px] font-mono uppercase ${theme.textSecondary}`}>Session notes</label>
              <textarea value={newSessionNotes} onChange={(e) => setNewSessionNotes(e.target.value)} rows={3} placeholder="Add session notes" className={`rounded-sm border px-2 py-1.5 text-xs ${theme.inputBg}`} />
            </div>

            <form onSubmit={handleCreateSchedule}>
              <Button type="submit" className="mt-2 self-end rounded-sm border-none bg-[#40938c] px-4 py-2 text-xs font-bold uppercase text-black">
                Inject Slot
              </Button>
            </form>
          </Card>

          <div className="flex flex-col gap-3">
            {schedule.map((session) => (
              <Card key={session.id} className={`flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between ${theme.cardBorder} ${theme.cardBg}`}>
                <div>
                  <p className={`text-sm font-bold uppercase ${theme.headingColor}`}>
                    {formatDate(session.date)} · <span className="text-xs font-mono text-[#40938c]">{session.time}</span>
                  </p>
                  <p className={`mt-0.5 text-xs font-mono ${theme.textSecondary}`}>[{session.title || "Standard Class Roster"}]</p>
                  <p className={`mt-1 text-xs ${theme.textMuted}`}>
                    Coach: {session.coach || "Club Staff"} | Tier: {session.min_level || "All Levels"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" type="button" className="rounded-sm border-none bg-[#40938c] px-3 py-2 text-xs font-bold uppercase text-black">
                    Booked
                  </Button>
                  <Button size="sm" type="button" variant="outline" onClick={() => handleDeleteSchedule(session.id)} className="rounded-sm text-xs uppercase">
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
          <div className="mb-4">
            <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>My Confirmed Placements</h2>
          </div>

          {bookings.filter((booking) => booking.user_id === profile.id).length === 0 ? (
            <p className={`text-xs ${theme.textMuted}`}>No active bookings found.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.filter((booking) => booking.user_id === profile.id).map((booking) => {
                const session = booking.session_id ? scheduleById.get(String(booking.session_id)) : undefined
                return (
                  <Card key={booking.id} className={`flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between ${theme.cardBorder} ${theme.cardBg}`}>
                    <div>
                      <p className={`text-sm font-bold uppercase ${theme.headingColor}`}>
                        {session ? formatDate(session.date) : "Training Interval"} {session?.time ? `· ${session.time}` : ""}
                      </p>
                      {session?.title && <p className={`mt-0.5 text-xs font-mono ${theme.textSecondary}`}>Focus: {session.title}</p>}
                    </div>
                    <Button type="button" size="sm" className="rounded-sm border border-zinc-500 bg-transparent text-xs uppercase text-red-400">
                      Retract Spot
                    </Button>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {active === "attendance" && (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Active Bookings Checklist</h2>
              <p className={`text-[11px] ${theme.textMuted}`}>Verify and toggle member check-in status</p>
            </div>
            <div className="flex gap-1 rounded-sm border border-zinc-700 bg-zinc-950 p-1">
              {(["all", "present", "absent", "late"] as const).map((filterOpt) => (
                <button
                  key={filterOpt}
                  type="button"
                  onClick={() => setAttendanceFilter(filterOpt)}
                  className={`rounded-xs px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${attendanceFilter === filterOpt ? "bg-[#40938c] font-bold text-black" : theme.textSecondary}`}
                >
                  {filterOpt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {filteredAttendance.length === 0 ? (
              <p className={`text-xs ${theme.textMuted}`}>No attendance profiles correspond to the selected filter.</p>
            ) : (
              filteredAttendance.map((record) => (
                <Card key={record.id} className={`flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between ${theme.cardBorder} ${theme.cardBg}`}>
                  <div>
                    <p className={`text-xs font-bold ${theme.headingColor}`}>{record.user_name}</p>
                    <p className={`mt-0.5 text-[10px] font-mono ${theme.textMuted}`}>
                      Tier: {record.user_level} · Session ID: {record.session_id?.substring(0, 8) || "unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {(["present", "absent", "late"] as const).map((statusType) => (
                      <button
                        key={statusType}
                        type="button"
                        onClick={() => markAttendance({
                          id: "", user_id: record.user_id, session_id: record.session_id, status: record.status, created_at: record.marked_at || new Date().toISOString(),
                        } as Booking, statusType)}
                        className={`rounded-sm border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide ${record.status === statusType ? (statusType === "present" ? "border-green-500/40 bg-green-500/10 text-green-400" : statusType === "absent" ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400") : `border-zinc-800 ${theme.textMuted}`}`}
                      >
                        {statusType}
                      </button>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {active === "leaders" && (
        <div>
          <div className="mb-4">
            <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Our Core Leadership & Coaches</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 w-full">
            {initialLeaders.map((leader) => (
              <Card key={leader.id} className={`overflow-hidden border p-0 ${theme.cardBorder} ${theme.cardBg}`}>
                <div className="flex flex-col gap-0 p-0 md:flex-row-reverse">
                  {leader.avatar_url ? (
                    <div className="relative h-64 w-full bg-zinc-950 md:h-auto md:w-64">
                      <img src={leader.avatar_url} alt={leader.name} className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-64 w-full items-center justify-center bg-zinc-950/40 text-xl font-bold uppercase tracking-widest text-[#40938c]/60 md:h-auto md:w-64">
                      {leader.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/40 pb-3">
                        <h4 className={`text-xl font-extrabold uppercase tracking-tight ${theme.headingColor}`}>{leader.name}</h4>
                        <Badge className="rounded-sm border border-[#40938c]/20 bg-[#40938c]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#40938c]">
                          {leader.role_title || "Coach / Leader"}
                        </Badge>
                      </div>

                      <p className={`text-sm leading-relaxed ${theme.textSecondary}`}>
                        {leader.bio || "No biography description provided yet."}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "support" && (
        <div className="grid grid-cols-1 gap-6">
          <Card className={`rounded-sm border p-6 ${theme.cardBorder} ${theme.cardBg}`}>
            <div className="mb-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#40938c]">Share advice or feedback</h3>
              <p className={`mt-0.5 text-[11px] font-mono ${theme.textMuted}`}>
                Send a short comment or suggestion for the club staff to review.
              </p>
            </div>

            <form onSubmit={handleSubmitSupportTicket} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className={`text-[10px] font-mono uppercase ${theme.textSecondary}`}>Comment topic</label>
                <select value={supportCategory} onChange={(e) => setSupportCategory(e.target.value)} className={`rounded-sm border px-2 py-1.5 text-xs font-mono ${theme.inputBg}`}>
                  <option value="Advice / Feedback">Advice / Feedback</option>
                  <option value="Training">Training</option>
                  <option value="Club Experience">Club Experience</option>
                  <option value="Booking">Booking</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className={`text-[10px] font-mono uppercase ${theme.textSecondary}`}>Your comment</label>
                <textarea rows={5} placeholder="Share any advice, comment, or improvement idea for the team..." value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} className={`rounded-sm border px-3 py-2 text-xs font-mono outline-none ${theme.inputBg}`} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => window.open("https://www.instagram.com/wci_badminton_club", "_blank", "noopener,noreferrer")} className="inline-flex items-center justify-center rounded-sm border border-[#40938c] bg-[#40938c] px-3 py-2 text-[10px] font-mono font-bold uppercase text-black">
                    View Club Profile on Instagram
                  </button>
                  <button type="button" onClick={() => window.open("https://www.instagram.com/m/wci_badminton_club", "_blank", "noopener,noreferrer")} className="inline-flex items-center justify-center rounded-sm border border-[#40938c] bg-[#40938c] px-3 py-2 text-[10px] font-mono font-bold uppercase text-black">
                    DM on Instagram
                  </button>
                </div>
                <Button type="submit" size="sm" className="rounded-sm border-none bg-[#40938c] px-4 py-2 text-xs font-bold uppercase text-black">
                  Submit comment
                </Button>
              </div>

              {supportStatus && (
                <p className={`text-[11px] font-mono ${supportStatus.startsWith("Success") ? "text-green-400" : "text-red-400"}`}>
                  {supportStatus}
                </p>
              )}
            </form>
          </Card>
        </div>
      )}

      {active === "settings" && (
        <div className="flex flex-col gap-4">
          <Card className={`flex flex-col gap-4 border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#40938c]">Account Configuration</h3>
              <p className={`text-[11px] ${theme.textMuted}`}>Modify display identities and visual configuration flags</p>
            </div>
            <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex w-full flex-col gap-1">
                <label className={`text-[10px] font-mono uppercase ${theme.textSecondary}`}>User Display Identity</label>
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} className={`rounded-sm border px-3 py-2 text-xs font-mono ${theme.inputBg}`} />
              </div>
              <Button size="sm" className="shrink-0 rounded-sm border-none bg-[#40938c] px-4 py-2 text-xs font-bold uppercase text-black">
                Commit Change
              </Button>
            </div>
          </Card>

          <Card className={`flex items-center justify-between border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
            <div>
              <h4 className={`text-xs font-bold uppercase tracking-wide ${theme.textSecondary}`}>Visual Display Mode</h4>
              <p className={`text-[11px] font-mono ${theme.textMuted}`}>Toggle alternative color layouts</p>
            </div>
            <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-2 text-[#40938c] hover:bg-zinc-950">
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </Card>
        </div>
      )}
    </DashboardShell>
  )
}
