"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DashboardShell, type NavItem } from "@/components/dashboard/shell"
import { Button, Card, Input, Label, Select } from "@/components/ui/primitives"
import type { Announcement, AttendanceRecord, Booking, Profile, ScheduleSession } from "@/lib/types"
import { CalendarDays, LayoutDashboard, Moon, Settings, Sun, Ticket, UserCheck } from "lucide-react"

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "My Bookings", icon: Ticket },
  { key: "attendance", label: "Attendance", icon: UserCheck },
  { key: "settings", label: "Settings", icon: Settings },
]
const DAYS = ["all", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const
const MONTHS = ["all", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const
const FILTERS = ["all", "present", "absent", "late"] as const
type Status = "present" | "absent" | "late"
type Theme = { card: string; input: string; muted: string }

function formatDate(value: string | null) {
  if (!value) return "TBD"
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function nameOf(member: Profile | undefined) {
  if (!member) return "Unknown Member"
  return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.full_name || member.email || "Unknown Member"
}

function sessionExpired(session: ScheduleSession) {
  if (!session.date || !session.time) return false
  const dateMatch = session.date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const timeMatch = session.time.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!dateMatch || !timeMatch) return false
  const date = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
  let hour = Number(timeMatch[3])
  if (timeMatch[5]?.toUpperCase() === "PM" && hour !== 12) hour += 12
  if (timeMatch[5]?.toUpperCase() === "AM" && hour === 12) hour = 0
  date.setHours(hour, Number(timeMatch[4]), 0, 0)
  return new Date() > date
}

export function TeacherDashboard({ profile, initialMembers, initialSchedule, initialAnnouncements, initialBookings, initialAttendanceRecords = [] }: { profile: Profile; initialMembers: Profile[]; initialSchedule: ScheduleSession[]; initialAnnouncements: Announcement[]; initialBookings: Booking[]; initialAttendanceRecords?: AttendanceRecord[] }) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")
  const [bookings, setBookings] = useState(initialBookings)
  const [records, setRecords] = useState(initialAttendanceRecords)
  const [confirming, setConfirming] = useState<ScheduleSession | null>(null)
  const [note, setNote] = useState("")
  const [joining, setJoining] = useState(false)
  const [attendanceView, setAttendanceView] = useState<"by-session" | "all-records">("by-session")
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>("all")
  const [dayFilter, setDayFilter] = useState<(typeof DAYS)[number]>("all")
  const [monthFilter, setMonthFilter] = useState<(typeof MONTHS)[number]>("all")
  const [tierFilter, setTierFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [memberFilter, setMemberFilter] = useState<string | null>(null)
  const [selection, setSelection] = useState<Record<string, Status>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [dark, setDark] = useState(true)
  const [name, setName] = useState(profile.full_name || "")
  const [savingName, setSavingName] = useState(false)
  const schedule = initialSchedule
  const theme: Theme = { card: dark ? "bg-zinc-900/40 border-zinc-800" : "bg-white border-zinc-200", input: dark ? "bg-zinc-950 text-white border-zinc-800" : "bg-white text-black border-zinc-300", muted: dark ? "text-zinc-400" : "text-zinc-600" }
  const visibleSchedule = useMemo(() => schedule.filter((item) => !sessionExpired(item)), [schedule])
  const myBookings = useMemo(() => bookings.filter((item) => item.user_id === profile.id), [bookings, profile.id])
  const scheduleById = useMemo(() => new Map(schedule.map((item) => [String(item.id), item])), [schedule])
  const bookedIds = useMemo(() => new Set(myBookings.map((item) => String(item.session_id))), [myBookings])
  const tiers = [...new Set(initialMembers.map((member) => member.level).filter(Boolean))] as string[]
  const announcement = [...initialAnnouncements].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  function recordFor(booking: Booking) {
    return records.find((record) => record.session_id === booking.session_id && record.user_id === booking.user_id)
  }

  function sessionMatches(session: ScheduleSession) {
    const date = parseDate(session.date)
    return (dayFilter === "all" || date?.toLocaleDateString(undefined, { weekday: "long" }) === dayFilter) && (monthFilter === "all" || date?.toLocaleDateString(undefined, { month: "long" }) === monthFilter) && (dateFilter === "all" || session.date === dateFilter)
  }

  function rowsFor(session: ScheduleSession) {
    return bookings.filter((booking) => booking.session_id === session.id && sessionMatches(session)).filter((booking) => memberFilter === null || booking.user_id === memberFilter).filter((booking) => tierFilter === "all" || initialMembers.find((member) => member.id === booking.user_id)?.level === tierFilter).filter((booking) => statusFilter === "all" || recordFor(booking)?.status === statusFilter)
  }

  async function joinSession(session: ScheduleSession) {
    setJoining(true)
    try {
      const response = await fetch("/api/bookings", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: session.id, notes: note.trim() || null }) })
      const result = await response.json().catch(() => ({}))
      const inserted = Array.isArray(result.data) ? result.data[0] : result.data
      if (!response.ok || !inserted) throw new Error(result.error || "Unable to join this session")
      setBookings((previous) => [...previous, inserted as Booking])
      setNote("")
      setConfirming(null)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to join this session")
    } finally {
      setJoining(false)
    }
  }

  async function cancelBooking(booking: Booking) {
    const response = await fetch("/api/bookings", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: booking.id }) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return alert(result.error || "Unable to cancel booking")
    setBookings((previous) => previous.filter((item) => item.id !== booking.id))
  }

  async function markAttendance(booking: Booking, nextStatus: Status) {
    const member = initialMembers.find((item) => item.id === booking.user_id)
    const existing = recordFor(booking)
    setSaving((previous) => ({ ...previous, [booking.id]: true }))
    try {
      if (existing) {
        const response = await fetch("/api/attendance", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendance_id: existing.id, status: nextStatus }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.data) throw new Error(result.error || "Unable to update attendance")
        setRecords((previous) => previous.map((record) => record.id === existing.id ? result.data as AttendanceRecord : record))
      } else {
        const response = await fetch("/api/attendance", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: String(booking.session_id ?? ""),
            user_id: String(booking.user_id ?? ""),
            user_name: nameOf(member),
            user_level: member?.level ?? "Unknown",
            status: nextStatus,
            notes: booking.notes ?? null,
          }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.data) throw new Error(result.error || "Unable to save attendance")
        setRecords((previous) => [...previous, result.data as AttendanceRecord])
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save attendance")
    } finally {
      setSaving((previous) => ({ ...previous, [booking.id]: false }))
    }
  }

  async function saveSession(rows: Booking[]) {
    for (const booking of rows) {
      const desired = selection[booking.id] ?? "present"
      if (desired !== (recordFor(booking)?.status ?? "not marked")) await markAttendance(booking, desired)
    }
  }

  async function saveName() {
    if (!name.trim()) return
    setSavingName(true)
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", profile.id)
    setSavingName(false)
    if (error) alert(error.message)
  }

  function resetFilters() {
    setStatusFilter("all")
    setDayFilter("all")
    setMonthFilter("all")
    setTierFilter("all")
    setDateFilter("all")
    setMemberFilter(null)
  }

  return (
    <div className={`min-h-screen ${dark ? "bg-[#0B0B0C] text-white" : "bg-zinc-50 text-black"}`}>
      <DashboardShell navItems={NAV} activeKey={active} onChange={setActive} displayName={name.trim() || profile.email || "Teacher"} subtitle={profile.email ?? ""} badgeLabel="Teacher">
        {active === "overview" && <Overview theme={theme} name={name.trim() || profile.email || "Teacher"} sessions={visibleSchedule.length} bookings={myBookings.length} attendance={records.length} announcement={announcement} />}
        {active === "schedule" && <Schedule theme={theme} sessions={visibleSchedule} bookedIds={bookedIds} confirming={confirming} setConfirming={setConfirming} note={note} setNote={setNote} joining={joining} joinSession={joinSession} />}
        {active === "bookings" && <Bookings theme={theme} bookings={myBookings} scheduleById={scheduleById} cancelBooking={cancelBooking} />}
        {active === "attendance" && <Attendance theme={theme} schedule={schedule} bookings={bookings} members={initialMembers} records={records} tiers={tiers} view={attendanceView} setView={setAttendanceView} statusFilter={statusFilter} setStatusFilter={setStatusFilter} dayFilter={dayFilter} setDayFilter={setDayFilter} monthFilter={monthFilter} setMonthFilter={setMonthFilter} tierFilter={tierFilter} setTierFilter={setTierFilter} dateFilter={dateFilter} setDateFilter={setDateFilter} memberFilter={memberFilter} setMemberFilter={setMemberFilter} rowsFor={rowsFor} selection={selection} setSelection={setSelection} saving={saving} saveSession={saveSession} resetFilters={resetFilters} />}
        {active === "settings" && <SettingsPanel theme={theme} name={name} setName={setName} saveName={saveName} savingName={savingName} dark={dark} setDark={setDark} />}
      </DashboardShell>
    </div>
  )
}

function Overview({ theme, name, sessions, bookings, attendance, announcement }: { theme: Theme; name: string; sessions: number; bookings: number; attendance: number; announcement?: Announcement }) {
  return <div className="flex flex-col gap-6"><Card className={`overflow-hidden ${theme.card}`}><div className="bg-[#40938c] p-6 text-black"><p className="text-sm font-medium opacity-80">Teacher console</p><h2 className="mt-2 text-2xl font-bold">Welcome, {name}</h2><p className="mt-1 text-sm opacity-80">Review sessions, join training, and mark attendance.</p></div></Card><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Stat icon={CalendarDays} label="Upcoming Sessions" value={sessions} theme={theme} /><Stat icon={Ticket} label="My Bookings" value={bookings} theme={theme} /><Stat icon={UserCheck} label="Attendance Records" value={attendance} theme={theme} /></div>{announcement && <Card className={`p-6 ${theme.card}`}><p className="text-xs font-semibold uppercase tracking-wide text-[#40938c]">Latest Announcement</p><h3 className="mt-2 text-xl font-bold">{announcement.title}</h3><p className={`mt-3 whitespace-pre-line text-sm leading-relaxed ${theme.muted}`}>{announcement.content}</p></Card>}</div>
}

function Schedule({ theme, sessions, bookedIds, confirming, setConfirming, note, setNote, joining, joinSession }: { theme: Theme; sessions: ScheduleSession[]; bookedIds: Set<string>; confirming: ScheduleSession | null; setConfirming: (value: ScheduleSession | null) => void; note: string; setNote: (value: string) => void; joining: boolean; joinSession: (session: ScheduleSession) => Promise<void> }) {
  if (confirming) return <Card className={`mx-auto flex max-w-xl flex-col gap-5 p-6 ${theme.card}`}><p className="text-[10px] uppercase tracking-widest text-[#40938c]">Selected Target Interval</p><h3 className="text-2xl font-black uppercase">{formatDate(confirming.date)}</h3><p className="font-mono text-sm font-bold text-[#40938c]">{confirming.time}</p><div className="grid gap-4 text-xs sm:grid-cols-2"><div className="border border-zinc-800 bg-zinc-950/40 p-3"><span className={theme.muted}>Training Context</span><p className="mt-1 font-bold">{confirming.title || "Standard Training Session"}</p></div><div className="border border-zinc-800 bg-zinc-950/40 p-3"><span className={theme.muted}>Session Description</span><p className="mt-1">{confirming.notes || "Session details will be provided by staff."}</p></div></div><Label>Optional note for staff/teacher<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className={`mt-2 w-full rounded-sm border px-3 py-2 text-xs ${theme.input}`} placeholder="Late arrival, early leave, or any note for the coach" /></Label><div className="flex justify-end gap-3 border-t border-zinc-800 pt-4"><Button variant="outline" disabled={joining} onClick={() => setConfirming(null)}>Cancel</Button><Button disabled={joining} onClick={() => void joinSession(confirming)} className="bg-[#40938c] text-black font-bold">{joining ? "Joining..." : "Confirm & Join"}</Button></div></Card>
  return <div><h2 className="mb-4 text-xs font-bold uppercase tracking-widest">Session Schedule</h2><div className="flex flex-col gap-3">{sessions.map((session) => { const booked = bookedIds.has(String(session.id)); return <Card key={session.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${theme.card}`}><div><p className="text-sm font-bold uppercase">{formatDate(session.date)} · <span className="font-mono text-xs text-[#40938c]">{session.time}</span></p><p className={`mt-1 text-xs font-bold ${theme.muted}`}>[{session.title || "Standard Class Roster"}]</p><p className={`mt-1 text-xs ${theme.muted}`}>Coach: {session.coach || "Club Staff"}</p><p className={`mt-1 text-xs ${theme.muted}`}>{session.notes || "Session details will be provided by staff."}</p></div><Button size="sm" disabled={booked} onClick={() => setConfirming(session)} className={booked ? "bg-zinc-700 text-white" : "bg-[#40938c] text-black font-bold"}>{booked ? "Claimed" : "Join Session"}</Button></Card> })}</div></div>
}

function Bookings({ theme, bookings, scheduleById, cancelBooking }: { theme: Theme; bookings: Booking[]; scheduleById: Map<string, ScheduleSession>; cancelBooking: (booking: Booking) => Promise<void> }) {
  return <div><h2 className="mb-4 text-xs font-bold uppercase tracking-widest">My Confirmed Placements</h2>{bookings.length === 0 ? <p className={`text-xs ${theme.muted}`}>No active bookings found.</p> : <div className="flex flex-col gap-3">{bookings.map((booking) => { const session = scheduleById.get(String(booking.session_id)); return <Card key={booking.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${theme.card}`}><div><p className="text-sm font-bold uppercase">{session ? formatDate(session.date) : "Training Interval"} {session?.time && `· ${session.time}`}</p>{session?.title && <p className={`mt-1 text-xs ${theme.muted}`}>Focus: {session.title}</p>}{booking.notes && <p className="mt-1 text-xs text-red-600 dark:text-red-300">Note: {booking.notes}</p>}</div><Button size="sm" onClick={() => void cancelBooking(booking)} className="border border-zinc-500 bg-transparent text-xs uppercase text-red-400">Retract Spot</Button></Card> })}</div>}</div>
}

function Attendance({ theme, schedule, bookings, members, records, tiers, view, setView, statusFilter, setStatusFilter, dayFilter, setDayFilter, monthFilter, setMonthFilter, tierFilter, setTierFilter, dateFilter, setDateFilter, memberFilter, setMemberFilter, rowsFor, selection, setSelection, saving, saveSession, resetFilters }: { theme: Theme; schedule: ScheduleSession[]; bookings: Booking[]; members: Profile[]; records: AttendanceRecord[]; tiers: string[]; view: "by-session" | "all-records"; setView: (value: "by-session" | "all-records") => void; statusFilter: (typeof FILTERS)[number]; setStatusFilter: (value: (typeof FILTERS)[number]) => void; dayFilter: (typeof DAYS)[number]; setDayFilter: (value: (typeof DAYS)[number]) => void; monthFilter: (typeof MONTHS)[number]; setMonthFilter: (value: (typeof MONTHS)[number]) => void; tierFilter: string; setTierFilter: (value: string) => void; dateFilter: string; setDateFilter: (value: string) => void; memberFilter: string | null; setMemberFilter: (value: string | null) => void; rowsFor: (session: ScheduleSession) => Booking[]; selection: Record<string, Status>; setSelection: (value: (previous: Record<string, Status>) => Record<string, Status>) => void; saving: Record<string, boolean>; saveSession: (rows: Booking[]) => Promise<void>; resetFilters: () => void }) {
  const recordFor = (booking: Booking) => records.find((record) => record.session_id === booking.session_id && record.user_id === booking.user_id)
  const filteredRecords = records.filter((record) => statusFilter === "all" || record.status === statusFilter).filter((record) => memberFilter === null || record.user_id === memberFilter).filter((record) => tierFilter === "all" || record.user_level === tierFilter)
  return <div><div className="mb-6 flex gap-2"><Button variant={view === "by-session" ? "secondary" : "outline"} size="sm" onClick={() => setView("by-session")}>By Session</Button><Button variant={view === "all-records" ? "secondary" : "outline"} size="sm" onClick={() => setView("all-records")}>All Records</Button></div><div className="mb-4 flex flex-wrap gap-2">{FILTERS.map((filter) => <Button key={filter} variant={statusFilter === filter ? "secondary" : "outline"} size="sm" className="uppercase tracking-widest text-[10px]" onClick={() => setStatusFilter(filter)}>{filter === "all" ? "All" : filter === "absent" ? "Miss" : filter.charAt(0).toUpperCase() + filter.slice(1)}</Button>)}</div><div className="mb-4 grid gap-3 md:grid-cols-5"><div><Label>Day</Label><Select value={dayFilter} onChange={(event) => setDayFilter(event.target.value as (typeof DAYS)[number])}>{DAYS.map((item) => <option key={item} value={item}>{item === "all" ? "All Days" : item}</option>)}</Select></div><div><Label>Month</Label><Select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value as (typeof MONTHS)[number])}>{MONTHS.map((item) => <option key={item} value={item}>{item === "all" ? "All Months" : item}</option>)}</Select></div><div><Label>Tier</Label><Select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}><option value="all">All Tiers</option>{tiers.map((item) => <option key={item} value={item}>{item}</option>)}</Select></div><div><Label>Date</Label><Input type="date" value={dateFilter === "all" ? "" : dateFilter} onChange={(event) => setDateFilter(event.target.value || "all")} /></div><div className="flex items-end"><Button variant="outline" size="sm" className="w-full" onClick={resetFilters}>Reset</Button></div></div><div className="mb-4"><Label>Filter by Member</Label><div className="mt-2 flex flex-wrap gap-2"><Button variant={memberFilter === null ? "secondary" : "outline"} size="sm" onClick={() => setMemberFilter(null)}>All Members</Button>{members.filter((member) => bookings.some((booking) => booking.user_id === member.id)).map((member) => <Button key={member.id} variant={memberFilter === member.id ? "secondary" : "outline"} size="sm" onClick={() => setMemberFilter(member.id)}>{member.full_name || member.email}</Button>)}</div></div>{view === "by-session" ? <div className="flex flex-col gap-4">{schedule.map((session) => { const rows = rowsFor(session); if (!rows.length) return null; return <Card key={session.id} className={`p-4 ${theme.card}`}><div className="mb-3"><h4 className="font-semibold">{session.title ?? "Untitled Session"}</h4><p className={`mt-1 text-sm ${theme.muted}`}>{formatDate(session.date)} · {session.time ?? "TBD"}</p></div><div className="mb-3 flex justify-end"><Button size="sm" variant="secondary" onClick={() => void saveSession(rows)}>Save Attendance</Button></div><AttendanceTable rows={rows} members={members} records={records} selection={selection} setSelection={setSelection} saving={saving} /></Card> })}</div> : <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950"><table className="min-w-full text-left text-sm"><thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-300"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Session Date & Title</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Marked At</th></tr></thead><tbody className="divide-y divide-zinc-800">{filteredRecords.map((record) => { const session = schedule.find((item) => item.id === record.session_id); return <tr key={record.id}><td className="px-4 py-3 text-xs text-zinc-100">{record.user_name}</td><td className="px-4 py-3 text-xs text-zinc-400">{record.user_level}</td><td className="px-4 py-3 text-xs text-zinc-300">{session?.title ?? "Unknown Session"}<div className="text-zinc-400">{formatDate(session?.date ?? null)}</div></td><td className="px-4 py-3 text-xs uppercase text-zinc-200">{record.status}</td><td className="px-4 py-3 text-xs text-zinc-400">{record.marked_at ? new Date(record.marked_at).toLocaleString() : "—"}</td></tr> })}</tbody></table></div>}</div>
}

function AttendanceTable({ rows, members, records, selection, setSelection, saving }: { rows: Booking[]; members: Profile[]; records: AttendanceRecord[]; selection: Record<string, Status>; setSelection: (value: (previous: Record<string, Status>) => Record<string, Status>) => void; saving: Record<string, boolean> }) {
  return <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950"><table className="min-w-full text-left text-sm"><thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-300"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Marked At</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-zinc-800">{rows.map((booking) => { const member = members.find((item) => item.id === booking.user_id); const record = records.find((item) => item.session_id === booking.session_id && item.user_id === booking.user_id); const status = record?.status ?? "not marked"; return <tr key={booking.id} className="hover:bg-zinc-900"><td className="px-4 py-3"><p className="font-medium text-zinc-100">{nameOf(member)}</p><p className="text-xs text-zinc-400">{booking.user_id}</p></td><td className="px-4 py-3 text-xs text-zinc-400">{member?.level || "N/A"}</td><td className="px-4 py-3 text-xs uppercase text-zinc-200">{status}</td><td className="px-4 py-3 text-xs text-zinc-400">{record?.marked_at ? new Date(record.marked_at).toLocaleString() : "—"}</td><td className="px-4 py-3"><div className="flex gap-3">{(["present", "late", "absent"] as const).map((option) => <label key={option} className="inline-flex items-center gap-2"><input type="radio" name={`attendance-${booking.id}`} checked={(selection[booking.id] ?? record?.status ?? "present") === option} disabled={saving[booking.id]} onChange={() => setSelection((previous) => ({ ...previous, [booking.id]: option }))} /><span className={`text-xs ${option === "present" ? "text-emerald-400" : option === "late" ? "text-amber-400" : "text-rose-400"}`}>{option.charAt(0).toUpperCase() + option.slice(1)}</span></label>)}</div></td></tr> })}</tbody></table></div>
}

function SettingsPanel({ theme, name, setName, saveName, savingName, dark, setDark }: { theme: Theme; name: string; setName: (value: string) => void; saveName: () => Promise<void>; savingName: boolean; dark: boolean; setDark: (value: boolean) => void }) {
  return <div className="flex flex-col gap-4"><Card className={`flex flex-col gap-4 p-5 ${theme.card}`}><div><h3 className="text-sm font-bold uppercase tracking-wide text-[#40938c]">Account Configuration</h3><p className={`text-[11px] ${theme.muted}`}>Modify display identity and theme configuration.</p></div><div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"><div className="flex w-full flex-col gap-1"><Label>Display Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} className={theme.input} /></div><Button onClick={() => void saveName()} disabled={savingName} className="bg-[#40938c] text-black font-bold">{savingName ? "Saving..." : "Save"}</Button></div></Card><Card className={`flex items-center justify-between p-5 ${theme.card}`}><div><h4 className="text-xs font-bold uppercase tracking-wide">Visual Display Mode</h4><p className={`text-[11px] ${theme.muted}`}>Toggle alternative color layouts.</p></div><button type="button" onClick={() => setDark(!dark)} className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-2 text-[#40938c]">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button></Card></div>
}

function Stat({ icon: Icon, label, value, theme }: { icon: typeof CalendarDays; label: string; value: number; theme: Theme }) {
  return <Card className={`flex items-center gap-4 p-4 ${theme.card}`}><div className="rounded-sm bg-[#40938c]/10 p-2.5 text-[#40938c]"><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-black">{value}</p><p className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</p></div></Card>
}
