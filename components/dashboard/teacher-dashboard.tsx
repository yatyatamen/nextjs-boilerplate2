"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DashboardShell, type NavItem } from "@/components/dashboard/shell"
import { Badge, Button, Card, Input, Label, Select, Textarea } from "@/components/ui/primitives"
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
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Settings,
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

function formatDate(date: string | null) {
  if (!date) return "TBD"
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const d = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  )
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
  const [members, setMembers] = useState(initialMembers)
  const [schedule, setSchedule] = useState(initialSchedule)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [bookings, setBookings] = useState(initialBookings)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialAttendanceRecords ?? [])

  const [newScheduleTitle, setNewScheduleTitle] = useState("")
  const [newScheduleDate, setNewScheduleDate] = useState("")
  const [newScheduleTime, setNewScheduleTime] = useState("3:20-4:30 PM")
  const [newScheduleCoach, setNewScheduleCoach] = useState(profile.full_name || profile.first_name || "Coach")
  const [newScheduleNotes, setNewScheduleNotes] = useState("")

  const displayName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email || "Teacher"

  const latestGeneralAnnouncement = [...announcements]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  const latestFeatureAnnouncement = [...announcements]
    .filter((item) => (item.title ?? "").toLowerCase().includes("website") || (item.title ?? "").toLowerCase().includes("feature"))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  async function handleBookSession(sessionId: string) {
    const { data, error } = await supabase
      .from("bookings")
      .insert({ user_id: profile.id, session_id: sessionId, status: "booked" })
      .select()

    if (!error && data && data[0]) {
      setBookings((prev) => [data[0] as Booking, ...prev])
    }
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!newScheduleTitle.trim() || !newScheduleDate) return

    const payload = {
      title: newScheduleTitle.trim(),
      date: newScheduleDate,
      time: newScheduleTime,
      min_level: "Bronze",
      max_level: "Diamond2",
      coach: newScheduleCoach.trim() || "Coach",
      notes: newScheduleNotes.trim(),
    }

    const { data, error } = await supabase.from("schedule").insert(payload).select()

    if (error) {
      alert(`Schedule DB Error: ${error.message}`)
      return
    }

    if (data && data[0]) {
      setSchedule((prev) => [data[0] as ScheduleSession, ...prev])
      setNewScheduleTitle("")
      setNewScheduleDate("")
      setNewScheduleTime("3:20-4:30 PM")
      setNewScheduleNotes("")
    }
  }

  async function deleteScheduleItem(id: string) {
    const { error } = await supabase.from("schedule").delete().eq("id", id)
    if (error) {
      alert(`Schedule delete failed: ${error.message}`)
      return
    }
    setSchedule((prev) => prev.filter((item) => item.id !== id))
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
          <Card className="overflow-hidden">
            <div className="bg-sidebar p-6 text-sidebar-foreground">
              <p className="text-sm text-sidebar-foreground/70">Teacher console</p>
              <h2 className="text-2xl font-bold">Welcome, {displayName}</h2>
              <p className="mt-1 text-sm text-sidebar-foreground/70">
                Manage sessions, review student booking activity, and stay aligned with club updates.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Members" value={members.length} icon={Users} />
            <StatCard label="Sessions" value={schedule.length} icon={CalendarDays} />
            <StatCard label="Bookings" value={bookings.length} icon={Ticket} />
          </div>

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
                  <p className="mt-3 text-xs text-muted-foreground">Posted {formatDate(latestGeneralAnnouncement.created_at)}</p>
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
                  <p className="mt-3 text-xs text-muted-foreground">Posted {formatDate(latestFeatureAnnouncement.created_at)}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {active === "schedule" && (
        <div className="space-y-6">
          <SectionHeader title="Schedule Management" desc="Create coaching blocks and open sessions for members." />

          <Card className="p-5">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateSchedule}>
              <div className="md:col-span-2">
                <Label>Session Title</Label>
                <Input value={newScheduleTitle} onChange={(e) => setNewScheduleTitle(e.target.value)} required />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={newScheduleDate} onChange={(e) => setNewScheduleDate(e.target.value)} required />
              </div>
              <div>
                <Label>Time</Label>
                <Select value={newScheduleTime} onChange={(e) => setNewScheduleTime(e.target.value)}>
                  <option value="3:20-4:30 PM">3:20-4:30 PM</option>
                  <option value="3:20-4:45 PM">3:20-4:45 PM</option>
                  <option value="3:20-5:00 PM">3:20-5:00 PM</option>
                  <option value="3:20-5:15 PM">3:20-5:15 PM</option>
                </Select>
              </div>
              <div>
                <Label>Coach</Label>
                <Input value={newScheduleCoach} onChange={(e) => setNewScheduleCoach(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Session Notes</Label>
                <Textarea value={newScheduleNotes} onChange={(e) => setNewScheduleNotes(e.target.value)} className="min-h-24" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" className="bg-[#40938c] text-black font-bold">Post Schedule</Button>
              </div>
            </form>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {schedule.map((session) => {
              const alreadyBooked = bookings.some((booking) => booking.session_id === session.id && booking.user_id === profile.id)
              return (
                <Card key={session.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{session.title || "Session"}</p>
                      <p className="text-xs text-muted-foreground">{session.coach || "Coach"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{session.min_level || "All"}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!window.confirm("Delete this schedule item? This action cannot be undone.")) return
                          void deleteScheduleItem(session.id)
                        }}
                        className="text-xs"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p>{formatDate(session.date)} · {session.time || "TBD"}</p>
                    {session.notes && <p>{session.notes}</p>}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleBookSession(session.id)}
                      disabled={alreadyBooked}
                      className="bg-[#40938c] text-black font-bold"
                    >
                      {alreadyBooked ? "Booked" : "Book Coaching Session"}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {active === "bookings" && (
        <div>
          <SectionHeader title="My Bookings" desc="Your coaching and supervision bookings." />
          <div className="grid gap-4 md:grid-cols-2">
            {bookings.filter((booking) => booking.user_id === profile.id).map((booking) => {
              const session = schedule.find((item) => item.id === booking.session_id)
              return (
                <Card key={booking.id} className="p-4">
                  <p className="font-semibold text-foreground">{session?.title || "Booked Session"}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {session ? `${formatDate(session.date)} · ${session.time || "TBD"}` : "Session details unavailable"}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Status: {booking.status || "booked"}</p>
                </Card>
              )
            })}
            {bookings.filter((booking) => booking.user_id === profile.id).length === 0 && (
              <Card className="p-6 text-center text-muted-foreground">No bookings yet.</Card>
            )}
          </div>
        </div>
      )}

      {active === "attendance" && (
        <div>
          <SectionHeader title="Attendance" desc="Mark attendance for every session and keep it synced with staff records." />
          <div className="grid gap-4 md:grid-cols-2">
            {schedule.map((session) => {
              const sessionBookings = bookings.filter((booking) => booking.session_id === session.id)
              return (
                <Card key={session.id} className="p-4">
                  <p className="font-semibold text-foreground">{session.title || "Session"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(session.date)} · {session.time || "TBD"}</p>
                  <div className="mt-4 space-y-3">
                    {sessionBookings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No bookings for this session yet.</p>
                    ) : (
                      sessionBookings.map((booking) => {
                        const member = members.find((candidate) => candidate.id === booking.user_id)
                        const existingStatus = attendanceRecords.find((record) => record.session_id === booking.session_id && record.user_id === booking.user_id)?.status
                        return (
                          <div key={booking.id} className="rounded-md border border-border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">{member?.full_name || member?.email || "Unknown member"}</p>
                                <p className="text-xs text-muted-foreground">{member?.email || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">Tier: {member?.level || "N/A"}</p>
                                {booking.notes && <p className="text-[10px] text-amber-600 dark:text-amber-300">Note: {booking.notes}</p>}
                              </div>
                              <Badge className="border border-zinc-700 bg-zinc-900 text-zinc-200">
                                {existingStatus || "pending"}
                              </Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => markAttendance(booking, "present")}>Present</Button>
                              <Button size="sm" variant="outline" onClick={() => markAttendance(booking, "late")}>Late</Button>
                              <Button size="sm" variant="outline" onClick={() => markAttendance(booking, "absent")}>Absent</Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {active === "leaders" && (
        <div>
          <SectionHeader title="Our Leaders" desc="Team profiles and coaching information." />
          <div className="grid gap-4 md:grid-cols-2">
            {initialLeaders.map((leader) => (
              <Card key={leader.id} className="p-4">
                <p className="text-lg font-semibold text-foreground">{leader.name}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{leader.role_title}</p>
                {leader.bio && <p className="mt-2 text-sm text-muted-foreground">{leader.bio}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "support" && (
        <div>
          <SectionHeader title="Contact & Support" desc="Use the club contact flow for help, questions, or support." />
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Instagram DMs and contact support are available here the same as the member dashboard.</p>
          </Card>
        </div>
      )}

      {active === "settings" && (
        <div>
          <SectionHeader title="Settings" desc="Teacher account preferences and profile details." />
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Your teacher account is active and synced with the club portal.</p>
          </Card>
        </div>
      )}
    </DashboardShell>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
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
