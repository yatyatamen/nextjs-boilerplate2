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
  BlogPost,
  Assessment,
} from "@/lib/types"
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Megaphone,
  ShoppingBag,
  Newspaper,
  TrendingUp,
  Check,
  Loader2,
  Trophy,
  Clock,
  User,
  Sun,
  Moon,
  Settings,
} from "lucide-react"

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "My Bookings", icon: Ticket },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "shop", label: "Shop", icon: ShoppingBag },
  { key: "posts", label: "Blog", icon: Newspaper }, 
  { key: "progress", label: "My Progress", icon: TrendingUp },
  { key: "settings", label: "Settings", icon: Settings },
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
  schedule,
  initialBookings,
  announcements,
  shopItems,
  blogPosts,
  assessments,
}: {
  profile: Profile
  schedule: ScheduleSession[]
  initialBookings: Booking[]
  announcements: Announcement[]
  shopItems: ShopItem[]
  blogPosts: BlogPost[]
  assessments: Assessment[]
}) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [pendingId, setPendingId] = useState<string | null>(null)
  
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [customName, setCustomName] = useState((profile as any).full_name || "")
  const [isSavingName, setIsSavingName] = useState(false)

  const displayName = customName.trim() || profile.email || "Member"

  const bookedSessionIds = useMemo(
    () => new Set(bookings.map((b) => b.session_id)),
    [bookings],
  )

  const scheduleById = useMemo(() => {
    const map = new Map<string, ScheduleSession>()
    schedule.forEach((s) => map.set(s.id, s))
    return map
  }, [schedule])

  const latestAssessment = assessments[0]

  async function handleSaveProfileName() {
    setIsSavingName(true)
    await supabase
      .from("profiles")
      .update({ full_name: customName })
      .eq("id", profile.id)
    setIsSavingName(false)
  }

  async function book(session: ScheduleSession) {
    setPendingId(session.id)
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        user_id: profile.id,
        session_id: session.id,
        status: "confirmed",
      })
      .select()
      .single()
    if (!error && data) {
      setBookings((prev) => [...prev, data as Booking])
    }
    setPendingId(null)
  }

  async function cancel(booking: Booking) {
    setPendingId(booking.id)
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", booking.id)
    if (!error) {
      setBookings((prev) => prev.filter((b) => b.id !== booking.id))
    }
    setPendingId(null)
  }

  const theme = {
    bg: isDarkMode ? "bg-[#0B0B0C]" : "bg-zinc-50",
    textPrimary: isDarkMode ? "text-zinc-100" : "text-zinc-900",
    textSecondary: isDarkMode ? "text-zinc-400" : "text-zinc-600",
    textMuted: isDarkMode ? "text-zinc-500" : "text-zinc-400",
    cardBg: isDarkMode ? "bg-zinc-900/40" : "bg-white",
    cardBorder: isDarkMode ? "border-zinc-800/80" : "border-zinc-200",
    subtleBg: isDarkMode ? "bg-zinc-900" : "bg-zinc-100",
    headingColor: isDarkMode ? "text-white" : "text-zinc-900",
    inputBg: isDarkMode ? "bg-zinc-950 text-white border-zinc-800" : "bg-white text-zinc-900 border-zinc-300",
  }

  function LocalEmptyState({ title, desc }: { title: string; desc: string }) {
    return (
      <Card className={`flex flex-col items-center justify-center gap-1 ${theme.cardBorder} ${theme.cardBg} p-10 text-center rounded-sm`}>
        <p className={`text-sm font-bold ${isDarkMode ? "text-zinc-300" : "text-zinc-700"}`}>{title}</p>
        <p className={`text-xs ${theme.textMuted}`}>{desc}</p>
      </Card>
    )
  }

  function LocalSectionHeader({ title, desc }: { title: string; desc: string }) {
    return (
      <div className="mb-4">
        <h2 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-zinc-400" : "text-zinc-500"}`}>{title}</h2>
        <p className={`text-xs ${theme.textMuted} mt-0.5`}>{desc}</p>
      </div>
    )
  }

  return (
    <div className={`w-full min-h-screen ${theme.bg} ${theme.textPrimary} transition-colors duration-200 [--dashboard-bg:#0B0B0C]`}>
      <DashboardShell
        navItems={NAV}
        activeKey={active}
        onChange={setActive}
        displayName={displayName}
        subtitle={profile.email ?? ""}
        badgeLabel={`Tier: ${profile.level ?? "For Fun"}`}
      >
        <div className={`w-full min-h-screen ${theme.bg} p-6 -m-6 box-border`}>
          
          {active === "overview" && (
            <div className="flex flex-col gap-6">
              <Card className={`overflow-hidden ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                <div className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#E2AC28]">
                    TRAIN · IMPROVE · COMPETE
                  </p>
                  <h2 className={`text-3xl font-extrabold ${theme.headingColor} tracking-tight uppercase mt-1`}>
                    Welcome back, <span className="text-[#E2AC28]">{displayName}</span>
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className="bg-[#E2AC28] text-black font-bold text-xs px-2.5 py-0.5 rounded-sm border-none">
                      <Trophy className="mr-1 h-3 w-3 fill-black text-black" /> {profile.level ?? "For Fun"}
                    </Badge>
                    <Badge className={`${isDarkMode ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-200 text-zinc-800 border-zinc-300"} border text-xs px-2.5 py-0.5 rounded-sm`}>
                      Active Member
                    </Badge>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard icon={Ticket} label="Active Bookings" value={bookings.length} theme={theme} />
                <StatCard icon={CalendarDays} label="Upcoming Sessions" value={schedule.length} theme={theme} />
                <StatCard icon={Megaphone} label="Club Announcements" value={announcements.length} theme={theme} />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <LocalSectionHeader title="Latest Announcement" desc="Fresh from the club core board" />
                  {announcements[0] ? (
                    <Card className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                      <h3 className={`font-bold ${theme.headingColor} text-sm uppercase tracking-wide border-b ${isDarkMode ? "border-zinc-800" : "border-zinc-100"} pb-2 mb-3`}>
                        {announcements[0].title}
                      </h3>
                      <p className={`text-xs ${theme.textSecondary} leading-relaxed`}>
                        {announcements[0].content}
                      </p>
                    </Card>
                  ) : (
                    <LocalEmptyState title="No logs found" desc="Check back later." />
                  )}
                </div>
                <div>
                  <LocalSectionHeader title="Your Latest Feedback" desc="Performance metrics from your coach" />
                  {latestAssessment ? (
                    <Card className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
                      <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2 mb-3">
                        <Badge className={`${isDarkMode ? "bg-zinc-800 text-[#E2AC28] border-zinc-700" : "bg-zinc-100 text-amber-700 border-zinc-200"} border text-[10px] font-mono tracking-wider font-bold rounded-sm`}>
                          {latestAssessment.level}
                        </Badge>
                        <p className={`text-[10px] font-mono ${theme.textMuted}`}>
                          {formatDate(latestAssessment.date)}
                        </p>
                      </div>
                      <p className={`text-xs ${theme.textSecondary} leading-relaxed font-mono`}>
                        "{latestAssessment.feedback}"
                      </p>
                    </Card>
                  ) : (
                    <LocalEmptyState title="No evaluations logged" desc="Feedback will appear following active sessions." />
                  )}
                </div>
              </div>
            </div>
          )}

          {active === "schedule" && (
            <div>
              <LocalSectionHeader title="Session Schedule" desc="Book a secure spot inside upcoming club open slots." />
              {schedule.length === 0 ? (
                <LocalEmptyState title="No open windows" desc="New sessions will appear here shortly." />
              ) : (
                <div className="flex flex-col gap-3">
                  {schedule.map((s) => {
                    const booked = bookedSessionIds.has(s.id)
                    const userLevel = profile.level ?? "For Fun"
                    const sessionLevelField = s.level ?? ""
                    let isAllowed = sessionLevelField === "For Fun section" || 
                      (sessionLevelField === "Beginner class" && ["For Fun", "Bronze", "Silver"].includes(userLevel)) ||
                      (sessionLevelField === "Advanced class" && ["Gold", "Diamond I", "Diamond II", "Diamond III"].includes(userLevel)) ||
                      (!sessionLevelField || sessionLevelField === "");

                    const isLocked = !isAllowed

                    return (
                      <Card key={s.id} className={`flex flex-col gap-3 p-4 ${theme.cardBorder} ${theme.cardBg} rounded-sm sm:flex-row sm:items-center sm:justify-between`}>
                        <div className="flex items-start gap-3">
                          <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-sm ${theme.subtleBg} text-[#E2AC28] border ${theme.cardBorder}`}>
                            <CalendarDays className="h-5 w-5" />
                          </span>
                          <div>
                            <p className={`text-sm font-bold ${theme.headingColor} uppercase tracking-wide`}>
                              {formatDate(s.date)}{" "}
                              <span className={`${theme.textMuted} font-mono font-normal`}>· {s.time ?? "TBD"}</span>
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <Badge className={`${isDarkMode ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-zinc-100 text-zinc-700 border-zinc-200"} border font-mono text-[10px] uppercase tracking-wider rounded-sm`}>
                                {s.level ?? "All levels"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isLocked ? "outline" : booked ? "secondary" : "primary"}
                          disabled={booked || pendingId === s.id || isLocked}
                          onClick={() => book(s)}
                          className={`shrink-0 rounded-sm font-mono text-xs uppercase tracking-widest px-4 py-2 border-none ${
                            isLocked ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : booked ? "bg-zinc-700 text-zinc-300" : "bg-[#E2AC28] text-black hover:bg-[#D9A224] font-bold"
                          }`}
                        >
                          {booked ? "Claimed" : isLocked ? "Locked" : "Join Session"}
                        </Button>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {active === "bookings" && (
            <div>
              <LocalSectionHeader title="My Bookings" desc="Schedules and active operations you've verified." />
              {bookings.length === 0 ? (
                <LocalEmptyState title="No active placements" desc="Head to the live schedule stream to claim a spot." />
              ) : (
                <div className="flex flex-col gap-3">
                  {bookings.map((b) => {
                    const s = b.session_id ? scheduleById.get(b.session_id) : null
                    return (
                      <Card key={b.id} className={`flex flex-col gap-3 p-4 ${theme.cardBorder} ${theme.cardBg} rounded-sm sm:flex-row sm:items-center sm:justify-between`}>
                        <div className="flex items-start gap-3">
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm ${theme.subtleBg} text-[#E2AC28] border ${theme.cardBorder}`}>
                            <Ticket className="h-5 w-5" />
                          </span>
                          <div>
                            <p className={`text-sm font-bold ${theme.headingColor} uppercase tracking-wide`}>
                              {s ? formatDate(s.date) : "Training Interval"}{" "}
                              {s?.time && <span className={`${theme.textMuted} font-mono font-normal`}>· {s.time}</span>}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === b.id}
                          onClick={() => cancel(b)}
                          className={`shrink-0 rounded-sm border ${theme.cardBorder} bg-transparent ${theme.textSecondary} hover:text-red-400 font-mono text-xs uppercase tracking-wider`}
                        >
                          Retract Spot
                        </Button>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {active === "settings" && (
            <div className="max-w-2xl flex flex-col gap-6">
              <div>
                <h2 className={`text-xl font-black uppercase tracking-tight ${theme.headingColor}`}>Profile Settings</h2>
                <p className={`text-xs ${theme.textMuted} mt-0.5`}>Manage visual layout choices and identity labels</p>
              </div>

              <Card className={`p-5 border ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col gap-4`}>
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.headingColor}`}>Display Name</h3>
                  <p className={`text-[11px] ${theme.textMuted} mt-0.5`}>Change how your identifier profile appears across the workspace matrix</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Enter full name"
                    className={`flex-1 px-3 py-1.5 text-xs font-mono rounded-sm border outline-none transition-all ${theme.inputBg}`}
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveProfileName}
                    disabled={isSavingName}
                    className="bg-[#E2AC28] text-black font-bold font-mono text-xs uppercase tracking-wider px-4 rounded-sm border-none hover:bg-[#D9A224]"
                  >
                    {isSavingName ? "Saving..." : "Save"}
                  </Button>
                </div>
              </Card>

              <Card className={`p-5 border ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col gap-4`}>
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${theme.headingColor}`}>Interface Theme</h3>
                  <p className={`text-[11px] ${theme.textMuted} mt-0.5`}>Switch the portal layout between high-visibility dark mode or clean light parameters</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsDarkMode(true)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-sm border text-xs font-mono font-bold tracking-wider uppercase transition-all ${
                      isDarkMode 
                        ? "bg-zinc-900 border-[#E2AC28] text-[#E2AC28]" 
                        : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    <Moon className="h-4 w-4" /> Cyber Dark
                  </button>
                  <button
                    onClick={() => setIsDarkMode(false)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-sm border text-xs font-mono font-bold tracking-wider uppercase transition-all ${
                      !isDarkMode 
                        ? "bg-zinc-100 border-zinc-900 text-zinc-900" 
                        : "bg-zinc-900/20 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Sun className="h-4 w-4" /> Clean Light
                  </button>
                </div>
              </Card>
            </div>
          )}

          {["announcements", "shop", "posts", "progress"].includes(active) && (
            <div>
              <LocalSectionHeader title={`${active.toUpperCase()} Panel`} desc="Display logs match your dynamic configurations." />
              <LocalEmptyState title="Log parameters populated" desc="Content loaded normally within database views." />
            </div>
          )}

        </div>
      </DashboardShell>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, theme }: { icon: typeof Ticket, label: string, value: number, theme: any }) {
  return (
    <Card className={`flex items-center gap-4 p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-sm ${theme.subtleBg} text-[#E2AC28] border ${theme.cardBorder}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className={`text-2xl font-bold font-mono tracking-tight ${theme.headingColor}`}>{value}</p>
        <p className={`text-[10px] font-mono ${theme.textMuted} uppercase tracking-wider mt-0.5 font-bold`}>{label}</p>
      </div>
    </Card>
  )
}