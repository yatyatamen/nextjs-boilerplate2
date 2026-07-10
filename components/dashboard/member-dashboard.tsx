"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DashboardShell, type NavItem } from "@/components/dashboard/shell"
import { Badge, Button, Card } from "@/components/ui/primitives"
import type {
  Profile,
  ScheduleSession,
  Booking,
  Announcement,
  ShopItem,
  Assessment,
  StaffProfile,
  AttendanceRecord,
  EquipmentRecommendation,
  SupportTicket,
} from "@/lib/types"
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Megaphone,
  ShoppingBag,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Award,
  Info,
  Mail,
  CheckCircle,
  XCircle,
  Sun,
  Moon,
  Settings,
  PlusCircle,
  MinusCircle,
  GraduationCap,
  Image,
  LifeBuoy,
} from "lucide-react"

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "My Bookings", icon: Ticket },
  { key: "assessments", label: "My Assessment", icon: TrendingUp },
  { key: "grading-manager", label: "Classroom Grading", icon: GraduationCap },
  { key: "attendance", label: "Active Check-Ins", icon: UserCheck },
  { key: "coaches", label: "Our Leaders", icon: Users },
  { key: "gear", label: "Equipment Guides", icon: Award },
  { key: "shop", label: "Wolves Shop", icon: ShoppingBag },
  { key: "club-info", label: "About Wolves", icon: Info },
  { key: "support", label: "Contact & Support", icon: LifeBuoy },
  { key: "settings", label: "Settings", icon: Settings },
]

const AVAILABLE_TIME_SLOTS = [
  "3:20-4:30 PM",
  "3:20-4:45 PM",
  "3:20-5:00 PM",
  "3:20-5:15 PM"
]

const PLAYER_TIERS = [
  "Bronze",
  "Silver",
  "Gold",
  "Diamond",
  "Diamond II"
]

function formatDate(date: string | null) {
  if (!date) return "TBD"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function MemberDashboard({
  profile,
  schedule: initialSchedule,
  initialBookings,
  announcements: initialAnnouncements,
  shopItems,
  assessments: initialAssessments,
  coaches: initialCoaches = [],
  attendanceRecords = [],
  gearGuides: initialGearGuides = [],
  allProfiles = [],
  supportTickets: initialTickets = [],
}: {
  profile: Profile
  schedule: ScheduleSession[]
  initialBookings: Booking[]
  announcements: Announcement[]
  shopItems: ShopItem[]
  assessments: Assessment[]
  coaches?: StaffProfile[]
  attendanceRecords?: AttendanceRecord[]
  gearGuides?: EquipmentRecommendation[]
  allProfiles?: Profile[]
  supportTickets?: SupportTicket[]
}) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")
  const [schedule, setSchedule] = useState<ScheduleSession[]>(initialSchedule)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments)
  const [coaches, setCoaches] = useState<StaffProfile[]>(initialCoaches)
  const [gearGuides, setGearGuides] = useState<EquipmentRecommendation[]>(initialGearGuides)
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(initialTickets)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [customName, setCustomName] = useState(profile.full_name || "")
  const [isSavingName, setIsSavingName] = useState(false)
  
  // Interactive Confirmation Window State
  const [confirmingSession, setConfirmingSession] = useState<ScheduleSession | null>(null)
  
  // Advanced State Fields
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>(attendanceRecords)
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "present" | "absent" | "late">("all")
  
  // Dropdown Form Management
  const [newSessionDate, setNewSessionDate] = useState("")
  const [newSessionTime, setNewSessionTime] = useState(AVAILABLE_TIME_SLOTS[0])
  const [newSessionLevel, setNewSessionLevel] = useState(PLAYER_TIERS[0])
  const [sessionTitles, setSessionTitles] = useState<string[]>(["Core Training Focus"])

  const [newAnnTitle, setNewAnnTitle] = useState("")
  const [newAnnContent, setNewAnnContent] = useState("")

  // Classroom Evaluation Grading Hooks
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [assignedGradeTier, setAssignedGradeTier] = useState(PLAYER_TIERS[0])
  const [numericScore, setNumericScore] = useState(80)
  const [critiqueFeedbackText, setCritiqueFeedbackText] = useState("")
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false)

  // Support Ticketing Hooks
  const [supportCategory, setSupportCategory] = useState("Technical Help")
  const [supportMessage, setSupportMessage] = useState("")
  const [supportStatus, setSupportStatus] = useState<string | null>(null)

  const displayName = customName.trim() || profile.email || "Member"
  const isStaff = profile.role === "staff"

  const bookedSessionIds = useMemo(() => new Set(bookings.map((b) => b.session_id)), [bookings])
  const scheduleById = useMemo(() => {
    const map = new Map<string, ScheduleSession>()
    schedule.forEach((s) => map.set(s.id, s))
    return map
  }, [schedule])

  // Computed filtration pipeline for attendance records
  const filteredAttendance = useMemo(() => {
    return attendanceList.filter(record => {
      if (attendanceFilter === "all") return true
      return record.status === attendanceFilter
    })
  }, [attendanceList, attendanceFilter])

  async function handleSaveProfileName() {
    setIsSavingName(true)
    await supabase.from("profiles").update({ full_name: customName }).eq("id", profile.id)
    setIsSavingName(false)
  }

  const handleAddTitleInputRow = () => setSessionTitles([...sessionTitles, ""])
  const handleRemoveTitleInputRow = (index: number) => setSessionTitles(sessionTitles.filter((_, i) => i !== index))
  const handleUpdateTitleRowValue = (index: number, value: string) => {
    const updated = [...sessionTitles]
    updated[index] = value
    setSessionTitles(updated)
  }

  async function handleCreateSession() {
    if (!newSessionDate) return
    const combinedFocusTitle = sessionTitles.filter(t => t.trim() !== "").join(" & ") || "General Drill Session"
    
    const { data, error } = await supabase
      .from("schedule")
      .insert({
        date: newSessionDate,
        time: newSessionTime,
        level: newSessionLevel,
        coach: displayName,
        title: combinedFocusTitle
      })
      .select()
      .single()
    
    if (!error && data) {
      setSchedule((prev) => [data as ScheduleSession, ...prev])
      setNewSessionDate("")
      setSessionTitles(["Core Training Focus"])
    }
  }

  async function handlePostAnnouncement() {
    if (!newAnnTitle || !newAnnContent) return
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: newAnnTitle,
        content: newAnnContent,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (!error && data) {
      setAnnouncements((prev) => [data as Announcement, ...prev])
      setNewAnnTitle("")
      setNewAnnContent("")
    }
  }

  async function submitPerformanceGrade() {
    if (!selectedStudentId || !critiqueFeedbackText) return
    setIsSubmittingGrade(true)
    
    const { data, error } = await supabase
      .from("assessments")
      .insert({
        user_id: selectedStudentId,
        level: assignedGradeTier,
        score: numericScore,
        feedback: critiqueFeedbackText,
        date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single()

    if (!error && data) {
      if (selectedStudentId === profile.id) {
        setAssessments(prev => [data as Assessment, ...prev])
      }
      setCritiqueFeedbackText("")
      alert("Grade report successfully logged onto ledger pipeline.")
    }
    setIsSubmittingGrade(false)
  }

  async function handleUpdateAssetLink(table: "staff_profiles" | "equipment_recommendations", id: string, field: string, url: string) {
    const { error } = await supabase.from(table).update({ [field]: url }).eq("id", id)
    if (!error) {
      if (table === "staff_profiles") {
        setCoaches(prev => prev.map(c => c.id === id ? { ...c, [field]: url } : c))
      } else {
        setGearGuides(prev => prev.map(g => g.id === id ? { ...g, [field]: url } : g))
      }
    }
  }

  async function submitSupportTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!supportMessage.trim()) return
    
    const { data, error } = await supabase.from("support_tickets").insert({
      user_id: profile.id,
      user_email: profile.email || "unknown@gapps.yrdsb.ca",
      subject: supportCategory,
      message: supportMessage,
      status: "open",
      created_at: new Date().toISOString()
    }).select().single()

    if (!error && data) {
      setSupportStatus("Success! System routing confirmation generated.")
      setSupportTickets(prev => [data as SupportTicket, ...prev])
      setSupportMessage("")
    } else {
      setSupportStatus("Failsafe warning: network dropped operational package.");
    }
  }

  async function book(session: ScheduleSession) {
    setPendingId(session.id)
    const { data, error } = await supabase
      .from("bookings")
      .insert({ user_id: profile.id, session_id: session.id, status: "confirmed" })
      .select()
      .single()
    if (!error && data) setBookings((prev) => [...prev, data as Booking])
    setPendingId(null)
  }

  async function cancel(booking: Booking) {
    setPendingId(booking.id)
    const { error } = await supabase.from("bookings").delete().eq("id", booking.id)
    if (!error) setBookings((prev) => prev.filter((b) => b.id !== booking.id))
    setPendingId(null)
  }

  async function toggleAttendance(id: string, nextStatus: "present" | "absent" | "late") {
    const { error } = await supabase.from("attendance").update({ status: nextStatus }).eq("id", id)
    if (!error) {
      setAttendanceList((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)))
    }
  }

  const theme = {
    bg: isDarkMode ? "bg-[#0B0B0C]" : "bg-zinc-50",
    textPrimary: isDarkMode ? "text-zinc-100" : "text-zinc-900",
    textSecondary: isDarkMode ? "text-zinc-400" : "text-zinc-600",
    textMuted: isDarkMode ? "text-zinc-500" : "text-zinc-400",
    cardBg: isDarkMode ? "bg-zinc-900/40" : "bg-white",
    cardBorder: isDarkMode ? "border-zinc-800" : "border-zinc-200",
    subtleBg: isDarkMode ? "bg-zinc-900" : "bg-zinc-100",
    headingColor: isDarkMode ? "text-white" : "text-zinc-900",
    inputBg: isDarkMode ? "bg-zinc-950 text-white border-zinc-800" : "bg-white text-zinc-900 border-zinc-300",
  }

  return (
    <div className={`w-full min-h-screen ${theme.bg} ${theme.textPrimary} transition-colors duration-200`}>
      <DashboardShell
        navItems={NAV.filter(item => (item.key !== "attendance" && item.key !== "grading-manager") || isStaff)}
        activeKey={active}
        onChange={(newKey) => {
          setActive(newKey)
          setConfirmingSession(null) // Clean state reset if changing tab parameters
        }}
        displayName={displayName}
        subtitle={profile.email ?? ""}
        badgeLabel={isStaff ? "Status: Management Staff" : `Tier: ${profile.level ?? "For Fun"}`}
      >
        <div className={`w-full min-h-screen ${theme.bg} p-6 -m-6 box-border`}>
          
          {/* OVERVIEW MODULE */}
          {active === "overview" && (
            <div className="flex flex-col gap-6">
              <Card className={`p-6 ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#E2AC28]">TRAIN · IMPROVE · COMPETE</p>
                <h2 className={`text-3xl font-extrabold ${theme.headingColor} tracking-tight uppercase mt-1`}>
                  Welcome, <span className="text-[#E2AC28]">{displayName}</span>
                </h2>
                <div className="mt-4 flex gap-2">
                  {!isStaff && (
                    <Badge className="bg-[#E2AC28] text-black font-bold text-xs px-2.5 py-0.5 rounded-sm border-none">
                      <Trophy className="mr-1 h-3 w-3 fill-black text-black" /> {profile.level ?? "For Fun"}
                    </Badge>
                  )}
                  {isStaff && <Badge className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-sm border-none font-bold uppercase tracking-wide">Club Staff</Badge>}
                </div>
              </Card>

              {isStaff && (
                <Card className={`p-5 border ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E2AC28] mb-3">
                    <PlusCircle className="h-4 w-4" /> Broadcast Dynamic Club Announcement
                  </div>
                  <div className="flex flex-col gap-3">
                    <input 
                      type="text" 
                      placeholder="Announcement Header Title" 
                      value={newAnnTitle}
                      onChange={(e) => setNewAnnTitle(e.target.value)}
                      className={`px-3 py-2 text-xs font-mono rounded-sm border outline-none ${theme.inputBg}`}
                    />
                    <textarea 
                      placeholder="Write system content alert here..." 
                      value={newAnnContent}
                      onChange={(e) => setNewAnnContent(e.target.value)}
                      rows={3}
                      className={`px-3 py-2 text-xs font-mono rounded-sm border outline-none ${theme.inputBg}`}
                    />
                    <Button size="sm" onClick={handlePostAnnouncement} className="bg-[#E2AC28] text-black font-bold text-xs uppercase font-mono py-2 rounded-sm border-none self-end">Publish Log</Button>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard icon={Ticket} label="Active Bookings" value={bookings.length} theme={theme} />
                <StatCard icon={CalendarDays} label="Upcoming Sessions" value={schedule.length} theme={theme} />
                <StatCard icon={Megaphone} label="Announcements" value={announcements.length} theme={theme} />
              </div>
            </div>
          )}

          {/* SCHEDULE MODULE */}
          {active === "schedule" && (
            <div>
              {!confirmingSession ? (
                <>
                  <div className="mb-4">
                    <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Session Schedule</h2>
                  </div>
                  
                  {isStaff && (
                    <Card className={`p-4 border border-[#E2AC28]/30 bg-[#E2AC28]/5 rounded-sm mb-4 flex flex-col gap-3`}>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#E2AC28]">Create New Schedule Track</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className={`px-2 py-1.5 text-xs font-mono rounded-sm border ${theme.inputBg}`} />
                        
                        <select value={newSessionTime} onChange={(e) => setNewSessionTime(e.target.value)} className={`px-2 py-1.5 text-xs font-mono rounded-sm border ${theme.inputBg}`}>
                          {AVAILABLE_TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                        </select>

                        <select value={newSessionLevel} onChange={(e) => setNewSessionLevel(e.target.value)} className={`px-2 py-1.5 text-xs font-mono rounded-sm border ${theme.inputBg}`}>
                          {PLAYER_TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-2">
                        <label className="text-[10px] font-mono uppercase text-zinc-400 flex justify-between">
                          <span>Training Context Target Matrices</span>
                          <button onClick={handleAddTitleInputRow} className="text-[#E2AC28] flex items-center gap-1 hover:underline"><PlusCircle className="h-3 w-3" /> Append Node</button>
                        </label>
                        {sessionTitles.map((title, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              placeholder="Context Target Title" 
                              value={title} 
                              onChange={(e) => handleUpdateTitleRowValue(idx, e.target.value)} 
                              className={`flex-1 px-2 py-1 text-xs font-mono rounded-sm border ${theme.inputBg}`} 
                            />
                            {sessionTitles.length > 1 && (
                              <button onClick={() => handleRemoveTitleInputRow(idx)} className="text-red-400 hover:text-red-500"><MinusCircle className="h-4 w-4" /></button>
                            )}
                          </div>
                        ))}
                      </div>

                      <Button size="sm" onClick={handleCreateSession} className="bg-[#E2AC28] text-black font-bold font-mono text-xs uppercase py-1.5 self-end rounded-sm border-none mt-2">Inject Slot</Button>
                    </Card>
                  )}

                  <div className="flex flex-col gap-3">
                    {schedule.map((s) => {
  const booked = bookedSessionIds.has(s.id)
  return (
    <Card key={s.id} className={`flex flex-col gap-3 p-4 ${theme.cardBorder} ${theme.cardBg} rounded-sm sm:flex-row sm:items-center sm:justify-between`}>
      <div>
        <p className={`text-sm font-bold ${theme.headingColor} uppercase`}>
          {formatDate(s.date)} · <span className="font-mono font-normal text-xs text-[#E2AC28]">{s.time}</span>
        </p>
        <p className="text-xs font-bold font-mono mt-0.5 text-zinc-300">[{s.title || "Standard Class Roster"}]</p>
        <p className={`text-xs ${theme.textMuted} mt-1`}>
          Coach: {s.coach || "Club Staff"} | Tier: {Array.isArray((s as any).visibility_tiers) ? (s as any).visibility_tiers.join(", ") : ((s as any).level || "All Levels")}
        </p>
      </div>
      <Button
        size="sm"
        disabled={booked || pendingId === s.id}
        onClick={() => setConfirmingSession(s)}
        className={`font-mono text-xs uppercase px-4 py-2 border-none rounded-sm ${booked ? "bg-zinc-700 text-zinc-300" : "bg-[#E2AC28] text-black font-bold"}`}
      >
        {booked ? "Claimed" : "Join Session"}
      </Button>
    </Card>
  )
})}
                  </div>
                </>
              ) : (
                /* INTERMEDIARY VERIFICATION CONFIRMATION VIEW */
                <div className="max-w-xl mx-auto py-4 animate-in fade-in duration-200">
                  <div className="mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-red-400">Verification Required</h2>
                    <p className={`text-[11px] ${theme.textMuted}`}>Please confirm your assignment entry parameters below</p>
                  </div>
                  
                  <Card className={`p-6 border-2 border-[#E2AC28]/40 ${theme.cardBg} rounded-sm flex flex-col gap-5`}>
                    <div className="border-b border-zinc-800/60 pb-4">
                      <span className="text-[10px] font-mono text-[#E2AC28] uppercase tracking-widest">Selected Target Interval</span>
                      <h3 className={`text-2xl font-black ${theme.headingColor} uppercase tracking-tight mt-1`}>
                        {formatDate(confirmingSession.date)}
                      </h3>
                      <p className="text-sm font-mono font-bold text-[#E2AC28] mt-0.5">{confirmingSession.time}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded-xs">
                        <span className="text-zinc-500 block uppercase text-[9px]">Training Context</span>
                        <span className="text-zinc-200 font-bold block mt-1 truncate">
                          {confirmingSession.title || "Standard Training Session"}
                        </span>
                      </div>
                      <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded-xs">
                        <span className="text-zinc-500 block uppercase text-[9px]">Target Classification</span>
                        <span className="text-zinc-200 font-bold block mt-1">
                          Tier {Array.isArray((confirmingSession as any).visibility_tiers) ? (confirmingSession as any).visibility_tiers.join(", ") : ((confirmingSession as any).level || "All Levels")}
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-sm flex gap-3 items-start">
                      <CheckCircle className="h-4 w-4 text-[#E2AC28] shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed text-zinc-400 font-mono">
                        <span className="text-zinc-200 font-bold">Roster Commitment:</span> Proceeding with this placement will reserve your slot inside the club's ledger array. Ensure this complies with your tier classification path.
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-zinc-800/40">
                      <button
                        disabled={pendingId !== null}
                        onClick={() => setConfirmingSession(null)}
                        className="px-4 py-2 text-xs font-mono uppercase tracking-wide text-zinc-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <Button
                        size="sm"
                        disabled={pendingId !== null}
                        onClick={async () => {
                          await book(confirmingSession)
                          setConfirmingSession(null)
                        }}
                        className="bg-[#E2AC28] text-black font-black font-mono text-xs uppercase px-5 py-2 rounded-sm border-none shadow-md shadow-[#E2AC28]/10"
                      >
                        {pendingId ? "Injecting Placement..." : "Confirm & Join"}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* MY BOOKINGS */}
          {active === "bookings" && (
            <div>
              <div className="mb-4"><h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>My Confirmed Placements</h2></div>
              {bookings.length === 0 ? (
                <p className={`text-xs ${theme.textMuted}`}>No active bookings found.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {bookings.map((b) => {
                    const s = b.session_id ? scheduleById.get(b.session_id) : null
                    return (
                      <Card key={b.id} className={`flex flex-col gap-3 p-4 ${theme.cardBorder} ${theme.cardBg} rounded-sm sm:flex-row sm:items-center sm:justify-between`}>
                        <div>
                          <p className={`text-sm font-bold ${theme.headingColor} uppercase`}>{s ? formatDate(s.date) : "Training Interval"} {s?.time && `· ${s.time}`}</p>
                          {s?.title && <p className="text-xs font-mono text-zinc-400 mt-0.5">Focus: {s.title}</p>}
                        </div>
                        <Button size="sm" onClick={() => cancel(b)} className="border border-zinc-500 bg-transparent text-xs uppercase text-red-400 font-mono rounded-sm">Retract Spot</Button>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ASSESSMENT MODULE */}
          {active === "assessments" && (
            <div>
              <div className="mb-4"><h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>My Performance Assessment</h2></div>
              {assessments.length === 0 ? (
                <Card className={`p-6 text-center ${theme.cardBorder} ${theme.cardBg} rounded-sm`}><p className={`text-xs ${theme.textMuted}`}>No evaluation marks logged yet by your trainers.</p></Card>
              ) : (
                <div className="flex flex-col gap-4">
                  {assessments.map((as) => (
                    <Card key={as.id} className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                      <div className="flex justify-between items-center border-b border-zinc-800/20 pb-2 mb-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold text-[#E2AC28]">Assigned Level Tier: {as.level}</span>
                          {as.score && <span className="text-[11px] font-mono text-zinc-300 mt-0.5">Rating Evaluation Score: {as.score}/100</span>}
                        </div>
                        <span className={`text-[10px] font-mono ${theme.textMuted}`}>{formatDate(as.date)}</span>
                      </div>
                      <p className={`text-xs ${theme.textSecondary} leading-relaxed bg-zinc-500/5 p-3 rounded-sm font-mono`}>"{as.feedback}"</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CLASSROOM GRADING DASHBOARD PANEL */}
          {active === "grading-manager" && isStaff && (
            <div>
              <div className="mb-4">
                <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Classroom Grading Station</h2>
                <p className={`text-[11px] ${theme.textMuted}`}>Log evaluations, assign rankings, and record training critiques</p>
              </div>
              <Card className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col gap-4`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Target Student Profile</label>
                    <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className={`px-2 py-1.5 text-xs font-mono rounded-sm border ${theme.inputBg}`}>
                      <option value="">-- Select Active Player --</option>
                      {allProfiles.map(student => (
                        <option key={student.id} value={student.id}>{student.full_name || student.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Target Level Placement</label>
                    <select value={assignedGradeTier} onChange={(e) => setAssignedGradeTier(e.target.value)} className={`px-2 py-1.5 text-xs font-mono rounded-sm border ${theme.inputBg}`}>
                      {PLAYER_TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">Numeric Marks Performance Evaluation ({numericScore}/100)</label>
                    <input type="range" min="0" max="100" value={numericScore} onChange={(e) => setNumericScore(Number(e.target.value))} className="w-full h-8 accent-[#E2AC28]" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono uppercase text-zinc-400">Critique Text Feedback Input Log</label>
                  <textarea 
                    rows={4} 
                    placeholder="Log details relative to court presence, tactical adjustments, footwork efficiency, and operational execution targets..."
                    value={critiqueFeedbackText}
                    onChange={(e) => setCritiqueFeedbackText(e.target.value)}
                    className={`px-3 py-2 text-xs font-mono rounded-sm border outline-none ${theme.inputBg}`}
                  />
                </div>

                <Button size="sm" onClick={submitPerformanceGrade} disabled={isSubmittingGrade || !selectedStudentId || !critiqueFeedbackText} className="bg-[#E2AC28] text-black font-bold font-mono text-xs uppercase py-2 self-end rounded-sm border-none">
                  {isSubmittingGrade ? "Processing Matrix..." : "Emit Tier Grade Record"}
                </Button>
              </Card>
            </div>
          )}

          {/* ACTIVE CHECK-INS / STUDENT ROSTER ATTENDANCE */}
          {active === "attendance" && isStaff && (
            <div>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Active Bookings Checklist</h2>
                  <p className={`text-[11px] ${theme.textMuted}`}>Verify and toggle real-time student check-in variants</p>
                </div>
                <div className="flex gap-1 bg-zinc-950 p-1 rounded-sm border border-zinc-800">
                  {(["all", "present", "absent", "late"] as const).map((filterOpt) => (
                    <button 
                      key={filterOpt}
                      onClick={() => setAttendanceFilter(filterOpt)}
                      className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded-xs tracking-wider transition-all ${attendanceFilter === filterOpt ? "bg-[#E2AC28] text-black font-bold" : "text-zinc-400 hover:text-white"}`}
                    >
                      {filterOpt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {filteredAttendance.length === 0 ? (
                  <p className={`text-xs ${theme.textMuted}`}>No attendance profiles correspond to specified filtering query.</p>
                ) : (
                  filteredAttendance.map((record) => (
                    <Card key={record.id} className={`p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                      <div>
                        <p className={`text-xs font-bold ${theme.headingColor}`}>{record.user_name}</p>
                        <p className={`text-[10px] ${theme.textMuted} font-mono mt-0.5`}>Tier: {record.user_level} · Session ID: {record.session_id.substring(0, 8)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        {(["present", "absent", "late"] as const).map((statusType) => (
                          <button
                            key={statusType}
                            onClick={() => toggleAttendance(record.id, statusType)}
                            className={`px-2.5 py-1 rounded-sm text-[10px] font-mono uppercase tracking-wide border transition-all ${
                              record.status === statusType 
                                ? statusType === "present" ? "bg-green-500/10 border-green-500/40 text-green-400 font-bold" 
                                  : statusType === "absent" ? "bg-red-500/10 border-red-500/40 text-red-400 font-bold" 
                                  : "bg-yellow-500/10 border-yellow-500/40 text-yellow-400 font-bold"
                                : "bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300"
                            }`}
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

{/* OUR LEADERS / INSTRUCTORS BIOGRAPHY */}
          {active === "coaches" && (
            <div>
              <div className="mb-4">
                <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>
                  Our Core Leadership & Coaches
                </h2>
              </div>
              
              {/* Using a 1-column layout so cards stretch out into beautiful wide rows */}
              <div className="grid grid-cols-1 gap-6 w-full">
                {coaches.map((c) => (
                  <Card 
                    key={c.id} 
                    className={`overflow-hidden ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col md:flex-row-reverse items-stretch gap-0 p-0`}
                  >
                    {/* RIGHT SIDE: Big Square Image Box */}
                    {c.avatar_url ? (
                      <div className="relative w-full md:w-64 h-64 md:h-auto shrink-0 bg-zinc-950">
                        <img 
                          src={c.avatar_url} 
                          alt={c.name} 
                          className="absolute inset-0 w-full h-full object-cover" 
                        />
                      </div>
                    ) : (
                      <div className="w-full md:w-64 h-64 md:h-auto shrink-0 bg-zinc-950/40 border-t md:border-t-0 md:border-l border-zinc-800/60 flex flex-col items-center justify-center text-[#E2AC28]/60 font-mono text-xl font-bold uppercase tracking-widest">
                        {c.name ? c.name.substring(0, 2).toUpperCase() : "WOLF"}
                      </div>
                    )}

                    {/* LEFT SIDE: Text content space */}
                    <div className="p-6 flex flex-col justify-between flex-1">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/40 pb-3 mb-4">
                          {/* Name font increased to text-xl font-extrabold */}
                          <h4 className={`text-xl font-extrabold uppercase tracking-tight ${theme.headingColor}`}>{c.name}</h4>
                          <Badge className="bg-[#E2AC28]/10 text-[#E2AC28] border border-[#E2AC28]/20 text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-sm">
                            {c.role_title || "Coach / Leader"}
                          </Badge>
                        </div>
                        
                        <p className={`text-sm ${theme.textSecondary} leading-relaxed`}>
                          {c.bio || "No biography description provided yet."}
                        </p>
                      </div>

                      {/* Staff Utilities (Includes Role Title Updater & Image Updater) */}
                      {isStaff && (
                        <div className="mt-6 pt-4 border-t border-zinc-800/40 flex flex-col gap-2">
                          {/* 1. Update Role Title input line */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase shrink-0 w-16">Role:</span>
                            <input 
                              type="text" 
                              placeholder="Update Role Title (e.g., Head Coach)..." 
                              defaultValue={c.role_title || ""}
                              onBlur={(e) => handleUpdateAssetLink("staff_profiles", c.id, "role_title", e.target.value)}
                              className={`w-full px-2 py-0.5 text-[10px] font-mono rounded-sm border outline-none ${theme.inputBg}`}
                            />
                          </div>

                          {/* 2. Update Image input line */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-500 uppercase shrink-0 w-16">Image URL:</span>
                            <input 
                              type="text" 
                              placeholder="Update Biography Image Link URL..." 
                              defaultValue={c.avatar_url || ""}
                              onBlur={(e) => handleUpdateAssetLink("staff_profiles", c.id, "avatar_url", e.target.value)}
                              className={`w-full px-2 py-0.5 text-[10px] font-mono rounded-sm border outline-none ${theme.inputBg}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {/* GEAR RECOMMENDATIONS */}
          {active === "gear" && (
            <div>
              <div className="mb-4"><h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Pro Recommended Equipment</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gearGuides.map((g) => (
                  <Card key={g.id} className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col justify-between gap-3`}>
                    <div className="flex gap-3">
                      {g.image_url && <img src={g.image_url} alt={g.title} className="h-16 w-16 object-contain rounded-sm bg-zinc-900 border border-zinc-800 p-1 shrink-0" />}
                      <div className="flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className={`text-sm font-bold uppercase tracking-wide ${theme.headingColor}`}>{g.title}</h4>
                          <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-[9px] font-mono px-1 rounded-sm">{g.recommended_for_tier}</Badge>
                        </div>
                        <p className={`text-xs font-mono text-[#E2AC28] mt-0.5`}>{g.brand} · <span className="text-zinc-400 font-sans">{g.specs}</span></p>
                        <p className={`text-xs ${theme.textSecondary} mt-2 leading-relaxed`}>{g.why_recommend}</p>
                      </div>
                    </div>
                    {isStaff && (
                      <div className="mt-2 pt-2 border-t border-zinc-800/40 flex items-center gap-2">
                        <Image className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <input 
                          type="text" 
                          placeholder="Update Gear Image Link URL..." 
                          defaultValue={g.image_url || ""}
                          onBlur={(e) => handleUpdateAssetLink("equipment_recommendations", g.id, "image_url", e.target.value)}
                          className={`w-full px-2 py-0.5 text-[10px] font-mono rounded-sm border outline-none ${theme.inputBg}`}
                        />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* WOLVES SHOP MODULE */}
          {active === "shop" && (
            <div>
              <div className="mb-4"><h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Wolves Merch & Equipment Store</h2></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {shopItems.map((item) => (
                  <Card key={item.id} className={`p-4 ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col justify-between gap-3`}>
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className={`text-sm font-bold ${theme.headingColor}`}>{item.name}</h4>
                        <span className="text-xs font-mono font-bold text-[#E2AC28]">${item.price}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">{item.category}</p>
                      <p className={`text-xs ${theme.textSecondary} mt-2`}>{item.description}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-zinc-800/30 pt-2 mt-1">
                      <span className="text-[10px] font-mono text-zinc-400">Stock: {item.stock ?? 0} units</span>
                      <Button size="sm" disabled className="bg-zinc-800 text-zinc-500 text-[10px] font-mono uppercase px-3 py-1 rounded-sm border-none">Purchase in Club</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ABOUT WOLVES INFO */}
          {active === "club-info" && (
            <div className="flex flex-col gap-6">
              <Card className={`p-6 ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                <h3 className="text-xl font-bold uppercase tracking-wide text-[#E2AC28]">About Wolves Badminton Club</h3>
                <p className={`text-xs ${theme.textSecondary} leading-relaxed mt-3 font-mono`}>
                  Founded upon principles of systematic tracking, rigorous court development, and tiered progression architectures, the Wolves Badminton Club provides student athletes and competitive players with premier training infrastructure. Our focus balances technical precision, structural agility metrics, and tournament execution frameworks.
                </p>
              </Card>
            </div>
          )}

          {/* CONTACT & SUPPORT HUB */}
          {active === "support" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 flex flex-col gap-4">
                <Card className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                  <div className="mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#E2AC28]">Submit Support Case / Request Ticket</h3>
                    <p className={`text-[11px] ${theme.textMuted} font-mono mt-0.5`}>Direct message pipeline straight to operational management desks</p>
                  </div>
                  <form onSubmit={submitSupportTicket} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono uppercase text-zinc-400">Inquiry Category</label>
                      <select value={supportCategory} onChange={(e) => setSupportCategory(e.target.value)} className={`px-2 py-1.5 text-xs font-mono rounded-sm border ${theme.inputBg}`}>
                        <option value="Technical Help">Technical Help / Portal Bugs</option>
                        <option value="Booking Inquiry">Booking Placements & Waiting Lists</option>
                        <option value="Grading & Leveling">Grading Matrix Disputes</option>
                        <option value="Other">General Feedback</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono uppercase text-zinc-400">Describe Issue / Message Payload</label>
                      <textarea
                        rows={4}
                        placeholder="Detail your request comprehensively here..."
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        className={`px-3 py-2 text-xs font-mono rounded-sm border outline-none ${theme.inputBg}`}
                      />
                    </div>
                    <Button type="submit" size="sm" className="bg-[#E2AC28] text-black font-bold font-mono text-xs uppercase py-2 rounded-sm border-none self-end">
                      Transmit Ticket Node
                    </Button>
                    {supportStatus && (
                      <p className={`text-[11px] font-mono mt-2 ${supportStatus.startsWith('Success') ? 'text-green-400' : 'text-red-400'}`}>
                        {supportStatus}
                      </p>
                    )}
                  </form>
                </Card>

                <Card className={`p-4 ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-300 mb-2">Your Open Tickets Ledger</h4>
                  {supportTickets.length === 0 ? (
                    <p className={`text-[11px] ${theme.textMuted} font-mono`}>No pending operations cases logged inside network cluster.</p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                      {supportTickets.map((ticket) => (
                        <div key={ticket.id} className="p-2 border border-zinc-800/60 bg-zinc-950/20 rounded-xs flex justify-between items-center text-[11px] font-mono">
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-[#E2AC28] font-bold">[{ticket.subject}]</span> <span className="text-zinc-400 truncate block">{ticket.message}</span>
                          </div>
                          <Badge className={`text-[9px] uppercase font-bold border-none px-1 rounded-xs ${ticket.status === 'open' ? 'bg-yellow-600/20 text-yellow-500' : 'bg-green-600/20 text-green-500'}`}>
                            {ticket.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div className="flex flex-col gap-4">
                <Card className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm text-center flex flex-col items-center justify-center gap-3`}>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white">Instant Social Dispatch</h4>
                    <p className={`text-[11px] ${theme.textMuted} font-mono mt-1`}>For rapid emergency check-ins or quick system updates, patch into our direct messaging channel.</p>
                  </div>
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" className="w-full">
                    <Button size="sm" className="w-full bg-[#E2AC28] text-black font-bold font-mono text-xs uppercase py-2 rounded-sm border-none flex items-center justify-center gap-1.5">
                      Open Instagram DM
                    </Button>
                  </a>
                </Card>
              </div>
            </div>
          )}

          {/* SETTINGS MODULE */}
          {active === "settings" && (
            <div className="flex flex-col gap-4">
              <Card className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col gap-4`}>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#E2AC28]">Account Configuration</h3>
                  <p className={`text-[11px] ${theme.textMuted}`}>Modify display identities and alter theme configuration flags</p>
                </div>
                <div className="flex flex-col sm:flex-row items-end gap-3 max-w-md">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] font-mono uppercase text-zinc-400">User Display Identity</label>
                    <input 
                      type="text" 
                      value={customName} 
                      onChange={(e) => setCustomName(e.target.value)} 
                      className={`px-3 py-2 text-xs font-mono rounded-sm border outline-none ${theme.inputBg}`} 
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveProfileName} disabled={isSavingName} className="bg-[#E2AC28] text-black font-bold font-mono text-xs uppercase py-2 px-4 rounded-sm border-none shrink-0">
                    {isSavingName ? "Saving..." : "Commit Change"}
                  </Button>
                </div>
              </Card>

              <Card className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm flex justify-between items-center`}>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-300">Visual Display Mode</h4>
                  <p className={`text-[11px] ${theme.textMuted} font-mono`}>Toggle alternative color layouts</p>
                </div>
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)} 
                  className="p-2 border border-zinc-800 rounded-sm bg-zinc-950/40 text-[#E2AC28] hover:bg-zinc-950"
                >
                  {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </Card>
            </div>
          )}

        </div>
      </DashboardShell>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, theme }: { icon: any, label: string, value: number, theme: any }) {
  return (
    <Card className={`p-4 border ${theme.cardBorder} ${theme.cardBg} rounded-sm flex items-center gap-4`}>
      <div className="p-2.5 rounded-sm bg-[#E2AC28]/10 text-[#E2AC28]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={`text-[10px] font-mono uppercase tracking-wider ${theme.textMuted}`}>{label}</p>
        <p className="text-2xl font-black font-mono tracking-tight text-white mt-0.5">{value}</p>
      </div>
    </Card>
  )
}