"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DashboardShell, type NavItem } from "@/components/dashboard/shell"
import { Button, Card, Input, Label } from "@/components/ui/primitives"
import type { Announcement, AttendanceRecord, Booking, Profile, ScheduleSession } from "@/lib/types"
import { CalendarDays, LayoutDashboard, Moon, Settings, Sun, Ticket, UserCheck } from "lucide-react"

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "My Bookings", icon: Ticket },
  { key: "attendance", label: "Attendance", icon: UserCheck },
  { key: "settings", label: "Settings", icon: Settings },
]

function formatDate(date: string | null) {
  if (!date) return "TBD"
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const parsed = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function isExpired(session: ScheduleSession | undefined) {
  if (!session?.date || !session.time) return false
  const dateMatch = session.date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const timeMatch = session.time.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!dateMatch || !timeMatch) return false
  const sessionDate = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
  let hour = Number(timeMatch[3])
  if (timeMatch[5]?.toUpperCase() === "PM" && hour !== 12) hour += 12
  if (timeMatch[5]?.toUpperCase() === "AM" && hour === 12) hour = 0
  sessionDate.setHours(hour, Number(timeMatch[4]), 0, 0)
  return new Date() > sessionDate
}

function getName(profile: Profile | undefined) {
  if (!profile) return "Unknown Member"
  return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.full_name || profile.email || "Unknown Member"
}

type Theme = { card: string; input: string; muted: string }

export function TeacherDashboard({
  profile,
  initialMembers,
  initialSchedule,
  initialAnnouncements,
  initialBookings,
  initialAttendanceRecords = [],
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialBookings: Booking[]
  initialAttendanceRecords?: AttendanceRecord[]
}) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")
  const [schedule] = useState(initialSchedule)
  const [bookings, setBookings] = useState(initialBookings)
  const [attendanceRecords, setAttendanceRecords] = useState(initialAttendanceRecords)
  const [confirmingSession, setConfirmingSession] = useState<ScheduleSession | null>(null)
  const [bookingNote, setBookingNote] = useState("")
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "present" | "absent" | "late">("all")
  const [attendanceSelection, setAttendanceSelection] = useState<Record<string, "present" | "absent" | "late">>({})
  const [pendingAttendance, setPendingAttendance] = useState<Record<string, boolean>>({})
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [customName, setCustomName] = useState(profile.full_name || "")
  const [savingName, setSavingName] = useState(false)

  const displayName = customName.trim() || profile.email || "Teacher"
  const scheduleById = useMemo(() => new Map(schedule.map((session) => [String(session.id), session])), [schedule])
  const visibleSchedule = useMemo(() => schedule.filter((session) => !isExpired(session)), [schedule])
  const myBookings = useMemo(() => bookings.filter((booking) => booking.user_id === profile.id), [bookings, profile.id])
  const bookedSessionIds = useMemo(() => new Set(myBookings.map((booking) => String(booking.session_id))), [myBookings])
  const latestAnnouncement = [...initialAnnouncements].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const theme: Theme = {
    card: isDarkMode ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200",
    input: isDarkMode ? "bg-zinc-950 text-white border-zinc-800" : "bg-white text-black border-zinc-300",
    muted: isDarkMode ? "text-zinc-400" : "text-zinc-600",
  }

  async function joinSession(session: ScheduleSession) {
    const response = await fetch("/api/bookings", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id, notes: bookingNote.trim() || null }),
    })
    const result = await response.json().catch(() => ({}))
    const inserted = Array.isArray(result.data) ? result.data[0] : result.data
    if (!response.ok || !inserted) {
      alert(result.error || "Unable to join this session")
      return
    }
    setBookings((prev) => [...prev, inserted as Booking])
    setBookingNote("")
    setConfirmingSession(null)
  }

  async function markAttendance(booking: Booking, status: "present" | "absent" | "late") {
    const member = initialMembers.find((entry) => entry.id === booking.user_id)
    const existing = attendanceRecords.find((record) => record.session_id === booking.session_id && record.user_id === booking.user_id)
    const now = new Date().toISOString()
    setPendingAttendance((prev) => ({ ...prev, [booking.id]: true }))

    try {
      if (existing) {
        const { error } = await supabase.from("attendance").update({ status, marked_at: now }).eq("id", existing.id)
        if (error) throw error
        setAttendanceRecords((prev) => prev.map((record) => record.id === existing.id ? { ...record, status, marked_at: now } : record))
      } else {
        const { data, error } = await supabase.from("attendance").insert({
          session_id: String(booking.session_id ?? ""),
          user_id: String(booking.user_id ?? ""),
          user_name: getName(member),
          user_level: member?.level ?? "Unknown",
          status,
          marked_at: now,
          notes: booking.notes ?? null,
        }).select().single()
        if (error) throw error
        setAttendanceRecords((prev) => [...prev, data as AttendanceRecord])
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save attendance")
    } finally {
      setPendingAttendance((prev) => ({ ...prev, [booking.id]: false }))
    }
  }

  async function saveName() {
    if (!customName.trim()) return
    setSavingName(true)
    const { error } = await supabase.from("profiles").update({ full_name: customName.trim() }).eq("id", profile.id)
    setSavingName(false)
    if (error) alert(error.message)
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "bg-[#0B0B0C] text-white" : "bg-zinc-50 text-black"}`}>
      <DashboardShell navItems={NAV} activeKey={active} onChange={setActive} displayName={displayName} subtitle={profile.email ?? ""} badgeLabel="Teacher">
        {active === "overview" && (
          <div className="flex flex-col gap-6">
            <Card className={`overflow-hidden ${theme.card}`}>
              <div className="bg-[#40938c] p-6 text-black">
                <p className="text-sm font-medium opacity-80">Teacher console</p>
                <h2 className="mt-2 text-2xl font-bold">Welcome, {displayName}</h2>
                <p className="mt-1 text-sm opacity-80">Review sessions, join training, and mark attendance.</p>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard icon={CalendarDays} label="Upcoming Sessions" value={visibleSchedule.length} theme={theme} />
              <StatCard icon={Ticket} label="My Bookings" value={myBookings.length} theme={theme} />
              <StatCard icon={UserCheck} label="Attendance Records" value={attendanceRecords.length} theme={theme} />
            </div>
            {latestAnnouncement && <Card className={`p-6 ${theme.card}`}><p className="text-xs font-semibold uppercase tracking-wide text-[#40938c]">Latest Announcement</p><h3 className="mt-2 text-xl font-bold">{latestAnnouncement.title}</h3><p className={`mt-3 whitespace-pre-line text-sm leading-relaxed ${theme.muted}`}>{latestAnnouncement.content}</p></Card>}
          </div>
        )}

        {active === "schedule" && (
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest">Session Schedule</h2>
            {!confirmingSession ? <div className="flex flex-col gap-3">{visibleSchedule.map((session) => {
              const booked = bookedSessionIds.has(String(session.id))
              return <Card key={session.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${theme.card}`}><div><p className="text-sm font-bold uppercase">{formatDate(session.date)} · <span className="font-mono text-xs text-[#40938c]">{session.time}</span></p><p className={`mt-1 text-xs ${theme.muted}`}>{session.title || "Standard Training Session"}</p><p className={`mt-1 text-xs ${theme.muted}`}>Coach: {session.coach || "Club Staff"}</p></div><Button type="button" size="sm" disabled={booked} onClick={() => setConfirmingSession(session)} className={booked ? "bg-zinc-700 text-white" : "bg-[#40938c] text-black font-bold"}>{booked ? "Claimed" : "Join Session"}</Button></Card>
            })}</div> : <Card className={`mx-auto flex max-w-xl flex-col gap-5 p-6 ${theme.card}`}><div><p className="text-[10px] uppercase tracking-widest text-[#40938c]">Selected Session</p><h3 className="mt-1 text-2xl font-black uppercase">{formatDate(confirmingSession.date)}</h3><p className="font-mono text-sm font-bold text-[#40938c]">{confirmingSession.time}</p></div><div className="flex flex-col gap-2"><Label>Optional note for staff</Label><textarea value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} rows={3} className={`rounded-sm border px-3 py-2 text-xs ${theme.input}`} placeholder="Late arrival, early leave, or another note" /></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setConfirmingSession(null)}>Cancel</Button><Button type="button" onClick={() => void joinSession(confirmingSession)} className="bg-[#40938c] text-black font-bold">Confirm & Join</Button></div></Card>}
          </div>
        )}

        {active === "bookings" && <div><h2 className="mb-4 text-xs font-bold uppercase tracking-widest">My Confirmed Bookings</h2>{myBookings.length === 0 ? <p className={`text-xs ${theme.muted}`}>No active bookings found.</p> : <div className="flex flex-col gap-3">{myBookings.map((booking) => { const session = scheduleById.get(String(booking.session_id)); return <Card key={booking.id} className={`p-4 ${theme.card}`}><p className="text-sm font-bold uppercase">{session ? formatDate(session.date) : "Training Session"} {session?.time && `· ${session.time}`}</p><p className={`mt-1 text-xs ${theme.muted}`}>{session?.title || "Session details"}</p></Card> })}</div>}</div>}

        {active === "attendance" && <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xs font-bold uppercase tracking-widest">Attendance</h2><p className={`mt-1 text-[11px] ${theme.muted}`}>Mark attendance for booked members.</p></div><div className="flex gap-1 rounded-sm border border-zinc-700 bg-zinc-950 p-1">{(["all", "present", "absent", "late"] as const).map((filter) => <button key={filter} type="button" onClick={() => setAttendanceFilter(filter)} className={`rounded-sm px-2 py-1 text-[10px] uppercase ${attendanceFilter === filter ? "bg-[#40938c] text-black font-bold" : "text-zinc-300"}`}>{filter}</button>)}</div></div><div className="flex flex-col gap-4">{schedule.map((session) => { const rows = bookings.filter((booking) => booking.session_id === session.id).filter((booking) => { const record = attendanceRecords.find((item) => item.session_id === booking.session_id && item.user_id === booking.user_id); return attendanceFilter === "all" || record?.status === attendanceFilter }); if (rows.length === 0) return null; return <Card key={session.id} className={`p-4 ${theme.card}`}><div className="mb-3"><h3 className="font-semibold">{session.title || "Training Session"}</h3><p className={`text-sm ${theme.muted}`}>{formatDate(session.date)} · {session.time || "TBD"}</p></div><div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950"><table className="min-w-full text-left text-sm"><thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-300"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Marked At</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-zinc-800">{rows.map((booking) => { const member = initialMembers.find((entry) => entry.id === booking.user_id); const record = attendanceRecords.find((item) => item.session_id === booking.session_id && item.user_id === booking.user_id); const status = record?.status ?? "not marked"; return <tr key={booking.id} className="hover:bg-zinc-900"><td className="px-4 py-3"><p className="font-medium text-zinc-100">{getName(member)}</p><p className="text-xs text-zinc-400">{booking.user_id}</p></td><td className="px-4 py-3 text-xs text-zinc-400">{member?.level || "N/A"}</td><td className="px-4 py-3 text-xs uppercase text-zinc-200">{status}</td><td className="px-4 py-3 text-xs text-zinc-400">{record?.marked_at ? new Date(record.marked_at).toLocaleString() : "—"}</td><td className="px-4 py-3"><div className="flex gap-3">{(["present", "late", "absent"] as const).map((option) => <label key={option} className="inline-flex items-center gap-2"><input type="radio" name={`attendance-${booking.id}`} checked={(attendanceSelection[booking.id] ?? record?.status ?? "present") === option} disabled={pendingAttendance[booking.id]} onChange={() => { setAttendanceSelection((prev) => ({ ...prev, [booking.id]: option })); void markAttendance(booking, option) }} /><span className={`text-xs ${option === "present" ? "text-emerald-400" : option === "late" ? "text-amber-400" : "text-rose-400"}`}>{option}</span></label>)}</div></td></tr> })}</tbody></table></div></Card> })}</div></div>}

        {active === "settings" && <div className="flex flex-col gap-4"><Card className={`flex flex-col gap-4 p-5 ${theme.card}`}><div><h3 className="text-sm font-bold uppercase tracking-wide text-[#40938c]">Account Configuration</h3><p className={`text-[11px] ${theme.muted}`}>Update your display name.</p></div><div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"><div className="flex w-full flex-col gap-1"><Label>Display Name</Label><Input value={customName} onChange={(event) => setCustomName(event.target.value)} className={theme.input} /></div><Button type="button" onClick={() => void saveName()} disabled={savingName} className="bg-[#40938c] text-black font-bold">{savingName ? "Saving..." : "Save"}</Button></div></Card><Card className={`flex items-center justify-between p-5 ${theme.card}`}><div><h4 className="text-xs font-bold uppercase tracking-wide">Visual Display Mode</h4><p className={`text-[11px] ${theme.muted}`}>Toggle the dashboard theme.</p></div><button type="button" onClick={() => setIsDarkMode((value) => !value)} className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-2 text-[#40938c]">{isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button></Card></div>}
      </DashboardShell>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, theme }: { icon: typeof CalendarDays; label: string; value: number; theme: Theme }) {
  return <Card className={`flex items-center gap-4 p-4 ${theme.card}`}><div className="rounded-sm bg-[#40938c]/10 p-2.5 text-[#40938c]"><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-black">{value}</p><p className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</p></div></Card>
}
