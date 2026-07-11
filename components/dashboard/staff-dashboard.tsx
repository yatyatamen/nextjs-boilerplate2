"use client"

import { useMemo, useState } from "react"
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
} from "lucide-react"

const ALL_6_TIERS = ["For Fun", "Bronze", "Silver", "Gold", "Diamond", "Diamond II"]
const TIME_SLOTS = ["3:20-4:15 PM", "3:20-4:30 PM", "3:20-4:45 PM", "3:20-5:00 PM", "3:20-5:15 PM", "3:20-5:30 PM"]

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "members", label: "Members", icon: Users },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "bookings", label: "Session Bookings", icon: Ticket },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "profiles", label: "Post Coach Bio", icon: UserPlus },
  { key: "shop", label: "Wolves Shop Items", icon: ShoppingBag },
  { key: "gear", label: "Equipment Guides", icon: BookOpen },
  { key: "assessments", label: "Assessments", icon: ClipboardList },
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

export function StaffDashboard({
  profile,
  initialMembers,
  initialSchedule,
  initialAnnouncements,
  initialShopItems,
  initialAssessments,
  initialBookings = [],
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialBlogPosts: BlogPost[]
  initialShopItems: ShopItem[]
  initialAssessments: Assessment[]
  initialBookings?: Booking[]
}) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")

  const [members, setMembers] = useState<Profile[]>(initialMembers)
  const [schedule, setSchedule] = useState<ScheduleSession[]>(initialSchedule)
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [shopItems, setShopItems] = useState<ShopItem[]>(initialShopItems)
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)

  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)

  const displayName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email || "Staff"

  return (
    <DashboardShell
      navItems={NAV}
      activeKey={active}
      onChange={setActive}
      displayName={displayName}
      subtitle={profile.email ?? ""}
      badgeLabel="Staff"
    >
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
          <SectionHeader title="Members" desc="View members and update their skill level." />
          <div className="flex flex-col gap-3">
            {members.map((m) => (
              <Card key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {`${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}`.toUpperCase() || "M"}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">
                      {`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Member"}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Level</Label>
                  <Select
                    value={m.level ?? ALL_6_TIERS[0]}
                    onChange={async (e) => {
                      const level = e.target.value
                      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, level } : x)))
                      await supabase.from("profiles").update({ level }).eq("id", m.id)
                    }}
                    className="h-9 w-40"
                  >
                    {ALL_6_TIERS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </Select>
                </div>
              </Card>
            ))}
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
              if (data && data[0]) setSchedule((prev) => [...prev, data[0] as ScheduleSession])
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
        <div>
          <SectionHeader title="Equipment Guide Publisher" desc="Upload technical equipment descriptions layout profiles." />
          <EquipmentGuideForm
            onCreate={async (payload) => {
              const { error } = await supabase.from("equipment_guides").insert(payload)
              if (error) alert(`Guides DB Error: ${error.message}`)
            }}
          />
        </div>
      )}

      {active === "assessments" && (
        <div>
          <SectionHeader title="Assessments" desc="Give feedback and instantly record a user's promotional tier." />
          <AssessmentForm
            members={members.filter((m) => m.role === "member")}
            onCreate={async ({ userId, level, feedback, date }) => {
              const { data, error } = await supabase
                .from("assessments")
                .insert({ user_id: userId, level, feedback, date })
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

function CoachProfileForm({ onCreate }: { onCreate: (payload: { name: string; description: string; pic_url: string }) => Promise<void> }) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [picUrl, setPicUrl] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    showConfirmation(
      "Publish Coach Profile?",
      `Add "${name}" to the coaches directory?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate({ name, description, pic_url: picUrl })
          setName("")
          setDescription("")
          setPicUrl("")
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

function ShopPostingForm({ onCreate }: { onCreate: (payload: { name: string; category: string; price: number; description: string; pic_url: string }) => Promise<void> }) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("Rackets")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [picUrl, setPicUrl] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    showConfirmation(
      "Add Shop Item?",
      `List "${name}" for $${Number(price) || 0} in ${category}?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate({ name, category, price: Number(price) || 0, description, pic_url: picUrl })
          setName("")
          setPrice("")
          setDescription("")
          setPicUrl("")
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

function EquipmentGuideForm({ onCreate }: { onCreate: (payload: { title: string; category: string; description: string; pic_url: string }) => Promise<void> }) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("Rackets")
  const [description, setDescription] = useState("")
  const [picUrl, setPicUrl] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    showConfirmation(
      "Publish Equipment Guide?",
      `Publish "${title}" guide for ${category}?`,
      async () => {
        setConfirmLoading(true)
        try {
          await onCreate({ title, category, description, pic_url: picUrl })
          setTitle("")
          setDescription("")
          setPicUrl("")
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
          <div className="flex flex-col gap-1.5"><Label>Image URL Reference</Label><Input value={picUrl} onChange={(e) => setPicUrl(e.target.value)} required /></div>
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
  onCreate: (payload: { userId: string; level: string; feedback: string; date: string }) => Promise<void>
}) {
  const { loading, setLoading } = useSubmitting()
  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
  const { toast, showToast } = useToast()
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState("")
  const [level, setLevel] = useState<string>(ALL_6_TIERS[0])
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
          await onCreate({ userId, level, feedback: feedback.trim(), date })
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