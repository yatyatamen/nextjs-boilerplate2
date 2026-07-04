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
import { LEVELS } from "@/lib/types"
import type {
  Profile,
  ScheduleSession,
  Announcement,
  ShopItem,
  BlogPost,
  Assessment,
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
} from "lucide-react"

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "members", label: "Members", icon: Users },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "blog", label: "Blog", icon: Newspaper },
  { key: "shop", label: "Shop", icon: ShoppingBag },
  { key: "assessments", label: "Assessments", icon: ClipboardList },
]

function formatDate(date: string | null) {
  if (!date) return "TBD"
  const d = new Date(date)
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
  initialBlogPosts,
  initialShopItems,
  initialAssessments,
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialBlogPosts: BlogPost[]
  initialShopItems: ShopItem[]
  initialAssessments: Assessment[]
}) {
  const supabase = createClient()
  const [active, setActive] = useState("overview")

  const [members, setMembers] = useState<Profile[]>(initialMembers)
  const [schedule, setSchedule] = useState<ScheduleSession[]>(initialSchedule)
  const [announcements, setAnnouncements] =
    useState<Announcement[]>(initialAnnouncements)
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(initialBlogPosts)
  const [shopItems, setShopItems] = useState<ShopItem[]>(initialShopItems)
  const [assessments, setAssessments] =
    useState<Assessment[]>(initialAssessments)

  const displayName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    profile.email ||
    "Staff"

  const memberName = (id: string | null) => {
    const m = members.find((x) => x.id === id)
    return m ? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() : "Unknown"
  }

  const memberCount = useMemo(
    () => members.filter((m) => m.role === "member").length,
    [members],
  )

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
                Manage members, sessions, and club content.
              </p>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="Members" value={memberCount} />
            <StatCard
              icon={CalendarDays}
              label="Sessions"
              value={schedule.length}
            />
            <StatCard
              icon={Megaphone}
              label="Announcements"
              value={announcements.length}
            />
            <StatCard
              icon={ClipboardList}
              label="Assessments"
              value={assessments.length}
            />
          </div>
        </div>
      )}

      {active === "members" && (
        <div>
          <SectionHeader
            title="Members"
            desc="View members and update their skill level."
          />
          {members.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No members yet.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {members.map((m) => (
                <Card
                  key={m.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {`${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}`.toUpperCase() ||
                        "M"}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">
                        {`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() ||
                          "Member"}
                        {m.role === "staff" && (
                          <Badge variant="accent" className="ml-2">
                            Staff
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Level
                    </Label>
                    <Select
                      value={m.level ?? "Beginner"}
                      onChange={async (e) => {
                        const level = e.target.value
                        setMembers((prev) =>
                          prev.map((x) =>
                            x.id === m.id ? { ...x, level } : x,
                          ),
                        )
                        await supabase
                          .from("profiles")
                          .update({ level })
                          .eq("id", m.id)
                      }}
                      className="h-9 w-40"
                    >
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {active === "schedule" && (
        <div>
          <SectionHeader
            title="Schedule"
            desc="Create and manage sessions."
          />
          <ScheduleForm
            onCreate={async (payload) => {
              const { data } = await supabase
                .from("schedule")
                .insert(payload)
                .select()
                .single()
              if (data) setSchedule((prev) => [...prev, data as ScheduleSession])
            }}
          />
          <div className="mt-6 flex flex-col gap-3">
            {schedule.map((s) => (
              <Card key={s.id} className="flex items-start gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-foreground">
                    {formatDate(s.date)}{" "}
                    <span className="text-muted-foreground">
                      · {s.time ?? "TBD"}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge>{s.level ?? "All levels"}</Badge>
                    {s.coach && <span>Coach: {s.coach}</span>}
                  </div>
                  {s.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {s.notes}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "announcements" && (
        <div>
          <SectionHeader
            title="Announcements"
            desc="Post updates for members."
          />
          <TitleContentForm
            titleLabel="Title"
            contentLabel="Content"
            submitLabel="Post announcement"
            onCreate={async (title, content) => {
              const { data } = await supabase
                .from("announcements")
                .insert({ title, content })
                .select()
                .single()
              if (data)
                setAnnouncements((prev) => [data as Announcement, ...prev])
            }}
          />
          <div className="mt-6 flex flex-col gap-3">
            {announcements.map((a) => (
              <Card key={a.id} className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(a.created_at)}
                </div>
                <h3 className="mt-1 font-semibold text-foreground">{a.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {a.content}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "blog" && (
        <div>
          <SectionHeader title="Blog" desc="Publish club stories and recaps." />
          <TitleContentForm
            titleLabel="Post title"
            contentLabel="Body"
            submitLabel="Publish post"
            onCreate={async (title, content) => {
              const { data } = await supabase
                .from("blog_posts")
                .insert({ title, content })
                .select()
                .single()
              if (data) setBlogPosts((prev) => [data as BlogPost, ...prev])
            }}
          />
          <div className="mt-6 flex flex-col gap-3">
            {blogPosts.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Newspaper className="h-3.5 w-3.5" />
                  {formatDate(p.created_at)}
                </div>
                <h3 className="mt-1 font-semibold text-foreground">{p.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {p.content}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "shop" && (
        <div>
          <SectionHeader title="Shop" desc="Manage store items." />
          <ShopForm
            onCreate={async (payload) => {
              const { data } = await supabase
                .from("shop_items")
                .insert(payload)
                .select()
                .single()
              if (data) setShopItems((prev) => [...prev, data as ShopItem])
            }}
          />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shopItems.map((item) => (
              <Card key={item.id} className="flex flex-col p-5">
                <Badge className="mb-2 self-start">
                  {item.category ?? "Gear"}
                </Badge>
                <h3 className="font-semibold text-foreground">{item.name}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
                <p className="mt-3 text-lg font-bold text-primary">
                  ${Number(item.price ?? 0).toFixed(2)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {active === "assessments" && (
        <div>
          <SectionHeader
            title="Assessments"
            desc="Give feedback and set a member's level."
          />
          <AssessmentForm
            members={members.filter((m) => m.role === "member")}
            onCreate={async ({ userId, level, feedback, date }) => {
              const { data } = await supabase
                .from("assessments")
                .insert({
                  user_id: userId,
                  level,
                  feedback,
                  date,
                })
                .select()
                .single()
              if (data) {
                setAssessments((prev) => [data as Assessment, ...prev])
                // Keep the member's profile level in sync.
                await supabase
                  .from("profiles")
                  .update({ level })
                  .eq("id", userId)
                setMembers((prev) =>
                  prev.map((m) => (m.id === userId ? { ...m, level } : m)),
                )
              }
            }}
          />
          <div className="mt-6 flex flex-col gap-3">
            {assessments.map((a) => (
              <Card key={a.id} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">
                    {memberName(a.user_id)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(a.date)}
                  </span>
                </div>
                <Badge variant="accent" className="mt-1">
                  {a.level}
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">
                  {a.feedback}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
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
    date: string
    time: string
    level: string
    coach: string
    notes: string
  }) => Promise<void>
}) {
  const { loading, setLoading } = useSubmitting()
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [level, setLevel] = useState<string>(LEVELS[0])
  const [coach, setCoach] = useState("")
  const [notes, setNotes] = useState("")

  return (
    <Card className="p-5">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!date) return
          setLoading(true)
          await onCreate({ date, time, level, coach, notes })
          setDate("")
          setTime("")
          setCoach("")
          setNotes("")
          setLoading(false)
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-date">Date</Label>
          <Input
            id="s-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-time">Time</Label>
          <Input
            id="s-time"
            placeholder="6:00 - 8:00 PM"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-level">Level</Label>
          <Select
            id="s-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-coach">Coach</Label>
          <Input
            id="s-coach"
            placeholder="Coach name"
            value={coach}
            onChange={(e) => setCoach(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="s-notes">Notes</Label>
          <Textarea
            id="s-notes"
            placeholder="Focus, court info, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add session
          </Button>
        </div>
      </form>
    </Card>
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
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  return (
    <Card className="p-5">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!title.trim()) return
          setLoading(true)
          await onCreate(title.trim(), content.trim())
          setTitle("")
          setContent("")
          setLoading(false)
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label>{titleLabel}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{contentLabel}</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-28"
          />
        </div>
        <div>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ShopForm({
  onCreate,
}: {
  onCreate: (payload: {
    name: string
    category: string
    price: number
    description: string
  }) => Promise<void>
}) {
  const { loading, setLoading } = useSubmitting()
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")

  return (
    <Card className="p-5">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          setLoading(true)
          await onCreate({
            name: name.trim(),
            category: category.trim(),
            price: Number(price) || 0,
            description: description.trim(),
          })
          setName("")
          setCategory("")
          setPrice("")
          setDescription("")
          setLoading(false)
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Category</Label>
          <Input
            placeholder="Racket, Apparel, Shuttles"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Price</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add item
          </Button>
        </div>
      </form>
    </Card>
  )
}

function AssessmentForm({
  members,
  onCreate,
}: {
  members: Profile[]
  onCreate: (payload: {
    userId: string
    level: string
    feedback: string
    date: string
  }) => Promise<void>
}) {
  const { loading, setLoading } = useSubmitting()
  const [userId, setUserId] = useState("")
  const [level, setLevel] = useState<string>(LEVELS[0])
  const [feedback, setFeedback] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  return (
    <Card className="p-5">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!userId) return
          setLoading(true)
          await onCreate({ userId, level, feedback: feedback.trim(), date })
          setFeedback("")
          setLoading(false)
        }}
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
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Feedback</Label>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Strengths, areas to improve, next steps..."
            className="min-h-28"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trophy className="h-4 w-4" />
            )}
            Save assessment
          </Button>
        </div>
      </form>
    </Card>
  )
}
