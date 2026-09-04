"use client"

import { useState } from "react"

import type { AttendanceRecord } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { DashboardShell, type NavItem } from "@/components/dashboard/shell"
import { Badge, Button, Card, Input, Label, Select, Textarea } from "@/components/ui/primitives"
import type {
  Announcement,
  Assessment,
  Booking,
  Profile,
  ScheduleSession,
  EquipmentRecommendation,
  ShopItem,
} from "@/lib/types"
import { LEVELS } from "@/lib/types"
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Settings,
  ShoppingBag,
  Ticket,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react"

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "My Bookings", icon: Ticket },
  { key: "assessments", label: "Assessments", icon: GraduationCap },
  { key: "attendance", label: "Attendance", icon: UserCheck },
  { key: "leaders", label: "Our Leaders", icon: Users },
  { key: "gear", label: "Equipment Guides", icon: Trophy },
  { key: "resources", label: "Rubrics & PDFs", icon: BookOpen },
  { key: "shop", label: "Wolves Shop", icon: ShoppingBag },
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
  initialAssessments,
  initialBookings,
  initialAttendanceRecords,
  initialGearGuides,
  initialResources,
  initialShopItems,
  initialLeaders,
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialAssessments: Assessment[]
  initialBookings: Booking[]
  initialAttendanceRecords?: AttendanceRecord[]
  initialGearGuides: EquipmentRecommendation[]
  initialResources: { id: string; title: string | null; url: string | null; created_at: string }[]
  initialShopItems: ShopItem[]
  initialLeaders: { id: string; name: string; role_title: string; bio: string | null; specialties: string[]; avatar_url: string | null }[]
}) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")
  const [members, setMembers] = useState(initialMembers)
  const [schedule, setSchedule] = useState(initialSchedule)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [assessments, setAssessments] = useState(initialAssessments)
  const [bookings, setBookings] = useState(initialBookings)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(initialAttendanceRecords ?? [])

  const [newScheduleTitle, setNewScheduleTitle] = useState("")
  const [newScheduleDate, setNewScheduleDate] = useState("")
  const [newScheduleTime, setNewScheduleTime] = useState("3:20-4:30 PM")
  const [newScheduleCoach, setNewScheduleCoach] = useState(profile.full_name || profile.first_name || "Coach")
  const [newScheduleNotes, setNewScheduleNotes] = useState("")

  const [newAssessmentUserId, setNewAssessmentUserId] = useState(initialMembers[0]?.id ?? "")
  const [newAssessmentLevel, setNewAssessmentLevel] = useState("Bronze")
  const [newAssessmentScore, setNewAssessmentScore] = useState(80)
  const [newAssessmentFeedback, setNewAssessmentFeedback] = useState("")
  const [newAssessmentDate, setNewAssessmentDate] = useState(new Date().toISOString().slice(0, 10))

  const displayName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email || "Teacher"

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

  async function handleCreateAssessment(e: React.FormEvent) {
    e.preventDefault()
    if (!newAssessmentUserId || !newAssessmentFeedback.trim()) return

    const { data, error } = await supabase
      .from("assessments")
      .insert({
        user_id: newAssessmentUserId,
        level: newAssessmentLevel,
        feedback: newAssessmentFeedback.trim(),
        score: newAssessmentScore,
        date: newAssessmentDate,
      })
      .select()

    if (error) {
      alert(`Assessment DB Error: ${error.message}`)
      return
    }

    if (data && data[0]) {
      setAssessments((prev) => [data[0] as Assessment, ...prev])
      setNewAssessmentFeedback("")
      setNewAssessmentScore(80)
    }
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
                Manage sessions, review student progress, and share learning resources with your classes.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Members" value={members.length} icon={Users} />
            <StatCard label="Sessions" value={schedule.length} icon={CalendarDays} />
            <StatCard label="Assessments" value={assessments.length} icon={GraduationCap} />
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
                  <p className="mt-3 text-xs text-muted-foreground">Posted {formatDate(announcements[0].created_at)}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {active === "schedule" && (
        <div className="space-y-6">
          <SectionHeader title="Schedule Management" desc="Create sessions and book into available coaching slots." />

          <Card className="p-5">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => {
              e.preventDefault()
              if (!newScheduleTitle.trim() || !newScheduleDate) return
              if (!window.confirm("Post this schedule item? This action cannot be undone.")) return
              void handleCreateSchedule(e)
            }}>
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
                      <Button size="sm" variant="outline" onClick={() => {
                        if (!window.confirm("Delete this schedule item? This action cannot be undone.")) return
                        void (async () => {
                          const { error } = await supabase.from("schedule").delete().eq("id", session.id)
                          if (!error) setSchedule((prev) => prev.filter((item) => item.id !== session.id))
                          else alert(`Schedule delete failed: ${error.message}`)
                        })()
                      }} className="text-xs">
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
                      {alreadyBooked ? "Booked" : "Book Session"}
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
          <SectionHeader title="My Bookings" desc="Your upcoming session bookings and attendance." />
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

      {active === "assessments" && (
        <div className="space-y-6">
          <SectionHeader title="Assessment Review" desc="Post assessments and feedback for student progress records." />

          <Card className="p-5">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => {
              e.preventDefault()
              if (!newAssessmentUserId || !newAssessmentFeedback.trim()) return
              if (!window.confirm("Save this assessment? This action cannot be undone.")) return
              void handleCreateAssessment(e)
            }}>
              <div>
                <Label>Student</Label>
                <Select value={newAssessmentUserId} onChange={(e) => setNewAssessmentUserId(e.target.value)}>
                  {members.filter((member) => member.role === "member").map((member) => (
                    <option key={member.id} value={member.id}>{member.full_name || member.email}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Level</Label>
                <Select value={newAssessmentLevel} onChange={(e) => setNewAssessmentLevel(e.target.value)}>
                  {LEVELS.map((tier) => (
                    <option key={tier} value={tier}>{tier}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Score</Label>
                <Input type="number" min={0} max={100} value={newAssessmentScore} onChange={(e) => setNewAssessmentScore(Number(e.target.value || 0))} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={newAssessmentDate} onChange={(e) => setNewAssessmentDate(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Feedback</Label>
                <Textarea value={newAssessmentFeedback} onChange={(e) => setNewAssessmentFeedback(e.target.value)} className="min-h-28" required />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" className="bg-[#40938c] text-black font-bold">Save Assessment</Button>
              </div>
            </form>
          </Card>

          <div className="grid gap-4">
            {assessments.map((assessment) => (
              <Card key={assessment.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{assessment.level || "Level"}</p>
                    <p className="text-xs text-muted-foreground">{assessment.score ?? 0}/100</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{formatDate(assessment.date)}</p>
                    <Button size="sm" variant="outline" onClick={() => {
                      if (!window.confirm("Delete this assessment? This action cannot be undone.")) return
                      void (async () => {
                        const { error } = await supabase.from("assessments").delete().eq("id", assessment.id)
                        if (!error) setAssessments((prev) => prev.filter((item) => item.id !== assessment.id))
                        else alert(`Assessment delete failed: ${error.message}`)
                      })()
                    }} className="text-xs">
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{assessment.feedback}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "attendance" && (
        <div>
          <SectionHeader title="Attendance" desc="Take attendance for booked sessions and keep it synced with the staff records." />
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
                        return (
                          <div key={booking.id} className="rounded-md border border-border p-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">{member?.full_name || member?.email || "Unknown member"}</p>
                                <p className="text-xs text-muted-foreground">Email: {member?.email || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">Level: {member?.level || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">
                                  Booked at: {booking.created_at ? new Date(booking.created_at).toLocaleString() : "N/A"}
                                </p>
                                {booking.notes && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-300">Note: {booking.notes}</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (!window.confirm("Cancel this booking?")) return
                                  void (async () => {
                                    const { error } = await supabase.from("bookings").delete().eq("id", booking.id)
                                    if (!error) {
                                      setBookings((prev) => prev.filter((item) => item.id !== booking.id))
                                    }
                                  })()
                                }}
                              >
                                Cancel
                              </Button>
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
          <SectionHeader title="Our Leaders" desc="Team profiles and coach information." />
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

      {active === "gear" && (
        <div>
          <SectionHeader title="Equipment Guides" desc="Browse recommended equipment and training tools." />
          <div className="grid gap-4 md:grid-cols-2">
            {initialGearGuides.map((guide) => (
              <Card key={guide.id} className="p-4">
                <p className="font-semibold text-foreground">{guide.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{guide.brand}</p>
                <p className="mt-2 text-sm text-muted-foreground">{guide.why_recommend}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "resources" && (
        <div>
          <SectionHeader title="Rubrics & PDFs" desc="Coach-created resources and printable guides." />
          <div className="grid gap-4 md:grid-cols-2">
            {initialResources.map((resource) => (
              <Card key={resource.id} className="p-4">
                <p className="font-semibold text-foreground">{resource.title}</p>
                <Button className="mt-4" size="sm" onClick={() => window.open(resource.url || "", "_blank")}>View PDF</Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "shop" && (
        <div>
          <SectionHeader title="Wolves Shop" desc="View club store items and gear available for purchase." />
          <div className="grid gap-4 md:grid-cols-2">
            {initialShopItems.map((item) => (
              <Card key={item.id} className="p-4">
                <p className="font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">${item.price ?? 0}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "support" && (
        <div>
          <SectionHeader title="Contact & Support" desc="How to reach the club or ask for help." />
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Use the team contact flow and support channels to get help quickly.</p>
          </Card>
        </div>
      )}

      {active === "settings" && (
        <div>
          <SectionHeader title="Settings" desc="Teacher account preferences." />
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Your teacher profile is active and synced with the club portal.</p>
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
