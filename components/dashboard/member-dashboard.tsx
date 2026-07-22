                                                "use client"

                                                import { useMemo, useState, useEffect, useRef } from "react"
                                                import Link from "next/link"
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
                                                  Resource,
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
                                                  SendHorizonal,
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
                                                  { key: "resources", label: "Rubrics & PDFs", icon: GraduationCap },
                                                  { key: "shop", label: "Wolves Shop", icon: ShoppingBag },
                                                  { key: "messages", label: "Messages", icon: Mail },
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

                                                function normalizeFilterValue(value: string | null | undefined) {
                                                  return (value ?? "").toString().trim().toLowerCase()
                                                }

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
                                                  const [messagesList, setMessagesList] = useState<(SupportTicket & { convoId?: string })[]>(
                                                    Array.isArray(initialTickets) ? initialTickets.map((t) => ({ ...t, convoId: t.id || t.subject || "_general_" })) : []
                                                  )
                                                  
                                                  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(
                                                    Array.isArray(initialTickets) && initialTickets.length ? (initialTickets[initialTickets.length - 1].id || initialTickets[initialTickets.length - 1].subject || "_general_") : null
                                                  )
                                                  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(initialTickets[0]?.id ?? null)
                                                  const messagesEndRef = useRef<HTMLDivElement | null>(null)
                                                  const [chatInput, setChatInput] = useState("")
                                                  const [pendingId, setPendingId] = useState<string | null>(null)
                                                  const [isDarkMode, setIsDarkMode] = useState(true)
                                                  const [customName, setCustomName] = useState(profile.full_name || "")
                                                  const [isSavingName, setIsSavingName] = useState(false)
                                                  
                                                  // Interactive Confirmation Window State
                                                  const [confirmingSession, setConfirmingSession] = useState<ScheduleSession | null>(null)
                                                  
                                                  // Advanced State Fields
                                                  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>(attendanceRecords)
                                                  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "present" | "absent" | "late">("all")
                                                  const [resources, setResources] = useState<Resource[]>([])
                                                  
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
                                                  const [guideInquiry, setGuideInquiry] = useState<{ isOpen: boolean; title: string; message: string }>({
                                                    isOpen: false,
                                                    title: "",
                                                    message: "",
                                                  })

                                                  const [gearFilter, setGearFilter] = useState("All")
                                                  const [gearTierFilter, setGearTierFilter] = useState("All")
                                                  const [gearSearch, setGearSearch] = useState("")
                                                  const [shopItemsState, setShopItemsState] = useState<ShopItem[]>(shopItems)
                                                  const [shopFilter, setShopFilter] = useState("All")
                                                  const [shopSearch, setShopSearch] = useState("")
                                                  const [shopPriceMin, setShopPriceMin] = useState<number | "">("")
                                                  const [shopPriceMax, setShopPriceMax] = useState<number | "">("")

                                                  // Confirmation & Toast Hooks
                                                  const { confirmState, showConfirmation, closeConfirmation } = useConfirmation()
                                                  const { toast, showToast } = useToast()
                                                  const [confirmLoading, setConfirmLoading] = useState(false)

                                                  const displayName = customName.trim() || profile.email || "Member"
                                                  const isStaff = profile.role === "staff"

                                                  const scheduleById = useMemo(() => {
                                                    const map = new Map<string, ScheduleSession>()
                                                    schedule.forEach((s) => map.set(String(s.id), s))
                                                    return map
                                                  }, [schedule])

                                                  // Determine if a session has already ended (date + end time)
                                                  function isSessionExpired(session: ScheduleSession | undefined): boolean {
                                                    if (!session || !session.date || !session.time) return false

                                                    const dateMatch = session.date.match(/^(\d{4})-(\d{2})-(\d{2})/)
                                                    if (!dateMatch) return false
                                                    const [, year, month, day] = dateMatch
                                                    const sessionDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

                                                    const timeMatch = session.time.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
                                                    if (!timeMatch) return false

                                                    const [, , , endHour, endMin, period] = timeMatch
                                                    let hour = parseInt(endHour)
                                                    const min = parseInt(endMin)
                                                    if (period?.toUpperCase() === "PM" && hour !== 12) {
                                                      hour += 12
                                                    } else if (period?.toUpperCase() === "AM" && hour === 12) {
                                                      hour = 0
                                                    }

                                                    const sessionEndTime = new Date(sessionDate)
                                                    sessionEndTime.setHours(hour, min, 0, 0)

                                                    return new Date() > sessionEndTime
                                                  }

                                                  useEffect(() => {
                                                    setShopItemsState(shopItems)
                                                  }, [shopItems])

                                                  const visibleSchedule = useMemo(() => schedule.filter((s) => !isSessionExpired(s)), [schedule])

                                                  const visibleBookings = useMemo(() => bookings.filter((b) => {
                                                    const session = b.session_id ? scheduleById.get(String(b.session_id)) : undefined
                                                    return !isSessionExpired(session)
                                                  }), [bookings, scheduleById])

                                                  const gearCategories = useMemo(
                                                    () => ["All", ...Array.from(new Set(gearGuides.map((g) => g.category || "Other")))],
                                                    [gearGuides],
                                                  )
                                                  const gearTierOptions = ["All", "Beginner", "Intermediate", "Advanced"]
                                                  const tierGroup = (tier?: string | null) => {
                                                    const normalized = (tier || "").toLowerCase()
                                                    if (/(for fun|bronze|silver)/i.test(normalized)) return "Beginner"
                                                    if (/gold/i.test(normalized)) return "Intermediate"
                                                    if (/diamond/i.test(normalized)) return "Advanced"
                                                    return "Other"
                                                  }
                                                  const filteredGearGuides = useMemo(() => {
                                                    const normalizedGearFilter = normalizeFilterValue(gearFilter)
                                                    const normalizedTierFilter = normalizeFilterValue(gearTierFilter)
                                                    const normalizedSearchValue = normalizeFilterValue(gearSearch)

                                                    return gearGuides.filter((g) => {
                                                      const categoryMatch = normalizedGearFilter === "all" || normalizeFilterValue(g.category || "Other") === normalizedGearFilter

                                                      // Normalize the raw recommended tier string and the grouped tier label
                                                      const rawRecommended = normalizeFilterValue(g.recommended_for_tier)
                                                      const grouped = normalizeFilterValue(tierGroup(g.recommended_for_tier))

                                                      // Match tier either by direct substring of the raw value or by the grouped label
                                                      const tierMatch =
                                                        normalizedTierFilter === "all" ||
                                                        (rawRecommended && rawRecommended.includes(normalizedTierFilter)) ||
                                                        (grouped && grouped === normalizedTierFilter)

                                                      const searchMatch =
                                                        !normalizedSearchValue ||
                                                        [g.title, g.brand, g.specs, g.why_recommend, g.category, g.recommended_for_tier]
                                                          .map((value) => normalizeFilterValue(value))
                                                          .some((text) => text.includes(normalizedSearchValue))

                                                      return categoryMatch && tierMatch && searchMatch
                                                    })
                                                  }, [gearGuides, gearFilter, gearTierFilter, gearSearch])

                                                  const shopCategories = useMemo(
                                                    () => ["All", ...Array.from(new Set(shopItemsState.map((item) => item.category || "Other")))],
                                                    [shopItemsState],
                                                  )
                                                  const filteredShopItems = useMemo(() => {
                                                    const normalizedShopFilter = normalizeFilterValue(shopFilter)
                                                    const normalizedSearchValue = normalizeFilterValue(shopSearch)

                                                    // Helper to coerce a value that may be number|null|string to a finite number or undefined
                                                    const toNumeric = (v: any): number | undefined => {
                                                      if (v === null || v === undefined || v === "") return undefined
                                                      if (typeof v === "number") return Number.isFinite(v) ? v : undefined
                                                      const n = Number(v)
                                                      return Number.isFinite(n) ? n : undefined
                                                    }

                                                    const minPrice = toNumeric(shopPriceMin)
                                                    const maxPrice = toNumeric(shopPriceMax)

                                                    return shopItemsState.filter((item) => {
                                                      const categoryMatch = normalizedShopFilter === "all" || normalizeFilterValue(item.category || "Other") === normalizedShopFilter
                                                      const searchMatch =
                                                        !normalizedSearchValue ||
                                                        [item.name, item.category, item.description, item.unit]
                                                          .map((value) => normalizeFilterValue(value))
                                                          .some((text) => text.includes(normalizedSearchValue))

                                                      const numericPrice = toNumeric(item.price)

                                                      // If both min and max provided and min > max, treat as no-match
                                                      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) return false

                                                      const minMatch = minPrice === undefined || (numericPrice !== undefined && numericPrice >= minPrice)
                                                      const maxMatch = maxPrice === undefined || (numericPrice !== undefined && numericPrice <= maxPrice)

                                                      return categoryMatch && searchMatch && minMatch && maxMatch
                                                    })
                                                  }, [shopItemsState, shopFilter, shopSearch, shopPriceMin, shopPriceMax])

                                                  const bookedSessionIds = useMemo(() => new Set(visibleBookings.map((b) => String(b.session_id))), [visibleBookings])

                                                  // Computed filtration pipeline for attendance records
                                                  const filteredAttendance = useMemo(() => {
                                                    const normalizedAttendanceFilter = normalizeFilterValue(attendanceFilter)
                                                    return attendanceList.filter(record => {
                                                      if (normalizedAttendanceFilter === "all") return true
                                                      return normalizeFilterValue(record.status) === normalizedAttendanceFilter
                                                    })
                                                  }, [attendanceList, attendanceFilter])

                                                  async function handleSaveProfileName() {
                                                    if (!customName.trim()) {
                                                      showToast("Please enter a display name before saving.")
                                                      return
                                                    }

                                                    setIsSavingName(true)
                                                    try {
                                                      const { error } = await supabase
                                                        .from("profiles")
                                                        .update({ full_name: customName.trim() })
                                                        .eq("id", profile.id)

                                                      if (error) {
                                                        throw error
                                                      }

                                                      showToast("Display name successfully changed")
                                                    } catch (error) {
                                                      showToast(error instanceof Error ? error.message : "Unable to update display name")
                                                    } finally {
                                                      setIsSavingName(false)
                                                    }
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

                                                  async function handleJsonResponse(response: Response) {
                                                    const text = await response.text()
                                                    if (!text.trim()) {
                                                      return response.ok ? { data: null } : { error: response.statusText || `Request failed (${response.status})` }
                                                    }

                                                    try {
                                                      return JSON.parse(text)
                                                    } catch {
                                                      const normalizedText = text.trim()
                                                      return {
                                                        error: normalizedText.includes("<html") || normalizedText.includes("<!DOCTYPE")
                                                          ? `Request failed (${response.status})`
                                                          : normalizedText || `Invalid JSON response (${response.status})`,
                                                      }
                                                    }
                                                  }

                                                  useEffect(() => {
                                                    if (active !== "messages") return

                                                    let mounted = true
                                                    ;(async () => {
                                                      try {
                                                        if (messagesList.length > 0) {
                                                          if (!selectedConvoId && messagesList[0]) {
                                                            const initialConvoId = (messagesList[0] as SupportTicket & { convoId?: string }).convoId || messagesList[0].subject || "_general_"
                                                            setSelectedConvoId(initialConvoId)
                                                          }
                                                          if (!selectedMessageId && messagesList[0]) {
                                                            setSelectedMessageId(String(messagesList[0].id))
                                                          }
                                                          return
                                                        }

                                                        const response = await fetch("/api/support?all=true", { credentials: "same-origin" })
                                                        const result = await handleJsonResponse(response)
                                                        if (!mounted) return

                                                        const normalized = Array.isArray(result?.data) ? result.data : []
                                                        if (normalized.length > 0) {
                                                          const annotated = (normalized as SupportTicket[]).map((t) => ({ ...t, convoId: t.id || t.subject || "_general_" }))
                                                          setMessagesList(annotated)
                                                          const latest = annotated.reduce((acc, cur) => {
                                                            if (!acc) return cur
                                                            return new Date(cur.created_at).getTime() > new Date(acc.created_at).getTime() ? cur : acc
                                                          }, annotated[0])
                                                          setSelectedConvoId(latest?.convoId ?? null)
                                                          if (!selectedMessageId && annotated[0]) {
                                                            setSelectedMessageId(String(annotated[0].id))
                                                          }
                                                        }
                                                      } catch (err) {
                                                        console.error("Failed to load messages:", err)
                                                      }
                                                    })()

                                                    return () => { mounted = false }
                                                  }, [active, messagesList.length, selectedMessageId])

                                                  useEffect(() => {
                                                    window.scrollTo({ top: 0, behavior: "auto" })

                                                    if (active !== "messages") return

                                                    const frame = window.requestAnimationFrame(() => {
                                                      const viewport = document.querySelector<HTMLElement>('[data-messages-scroll-container]')
                                                      if (viewport) {
                                                        viewport.scrollTop = viewport.scrollHeight
                                                      }
                                                      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
                                                      const composer = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Type a message..."]')
                                                      composer?.focus()
                                                    })

                                                    return () => window.cancelAnimationFrame(frame)
                                                  }, [active])

                                                  useEffect(() => {
                                                    if (active !== "messages") return

                                                    const frame = window.requestAnimationFrame(() => {
                                                      const viewport = document.querySelector<HTMLElement>('[data-messages-scroll-container]')
                                                      if (viewport) {
                                                        viewport.scrollTop = viewport.scrollHeight
                                                      }
                                                      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
                                                    })

                                                    return () => window.cancelAnimationFrame(frame)
                                                  }, [active, messagesList.length, selectedConvoId])

                                                  // Set up real-time listener for support ticket responses - only listen for external updates, not own messages
                                                  useEffect(() => {
                                                    let channel: any
                                                    try {
                                                      channel = supabase
                                                        .channel(`support_tickets:user:${profile.id}`)
                                                        .on(
                                                          "postgres_changes",
                                                          {
                                                            event: "UPDATE",
                                                            schema: "public",
                                                            table: "support_tickets",
                                                            filter: `user_id=eq.${profile.id}`,
                                                          },
                                                          (payload: any) => {
                                                            console.log("Support ticket update received:", payload)
                                                            const updatedTicket = (payload.new ?? payload.record) as SupportTicket
                                                            if (updatedTicket) {
                                                              setMessagesList((prev) =>
                                                                prev.map((m) => (m.id === updatedTicket.id ? updatedTicket : m))
                                                              )
                                                            }
                                                          },
                                                        )
                                                        .subscribe()
                                                    } catch (err) {
                                                      console.error("Failed to subscribe to support ticket updates:", err)
                                                    }

                                                    return () => {
                                                      if (channel) {
                                                        supabase.removeChannel(channel)
                                                      }
                                                    }
                                                  }, [profile.id, supabase])

                                                  const visibleConversationMessages = selectedConvoId ? messagesList.filter((m) => m.convoId === selectedConvoId) : messagesList
                                                  const selectedMessage = visibleConversationMessages.find((m) => String(m.id) === selectedMessageId) ?? visibleConversationMessages[visibleConversationMessages.length - 1] ?? null
                                                  const orderedConversations = useMemo(() => {
                                                    const latestByConvo = new Map<string, (SupportTicket & { convoId?: string })>()

                                                    messagesList.forEach((message) => {
                                                      const convoKey = message.convoId ?? message.subject ?? "_general_"
                                                      const current = latestByConvo.get(convoKey)
                                                      if (!current || new Date(message.created_at).getTime() > new Date(current.created_at).getTime()) {
                                                        latestByConvo.set(convoKey, message as SupportTicket & { convoId?: string })
                                                      }
                                                    })

                                                    return Array.from(latestByConvo.values()).sort((a, b) => {
                                                      const timeA = new Date(a.created_at).getTime()
                                                      const timeB = new Date(b.created_at).getTime()
                                                      return timeB - timeA
                                                    })
                                                  }, [messagesList])

                                                  async function sendChatMessage(e: React.FormEvent) {
                                                    e.preventDefault()
                                                    if (!chatInput.trim()) return

                                                    const activeConversationId = selectedConvoId || selectedMessage?.convoId || selectedMessage?.subject || `support-${Date.now()}`
                                                    const activeConversationSubject = selectedMessage?.subject || (selectedConvoId ? selectedConvoId : "Member message")
                                                    const messageText = chatInput.trim()
                                                    const optimisticMessage: SupportTicket = {
                                                      id: `local-${Date.now()}`,
                                                      user_id: profile.id,
                                                      user_email: profile.email || "",
                                                      subject: activeConversationSubject,
                                                      message: messageText,
                                                      status: "open",
                                                      created_at: new Date().toISOString(),
                                                    }
                                                    const annotated = { ...optimisticMessage, convoId: activeConversationId }
                                                    setMessagesList((prev) => [...prev, annotated])
                                                    setSelectedConvoId(activeConversationId)
                                                    setSelectedMessageId(String(annotated.id))
                                                    setChatInput("")

                                                    try {
                                                      const response = await fetch("/api/support", {
                                                        method: "POST",
                                                        credentials: "same-origin",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ subject: activeConversationSubject, message: messageText }),
                                                      })

                                                      const result = await handleJsonResponse(response)
                                                      if (!response.ok) {
                                                        return
                                                      }

                                                      const inserted = Array.isArray(result.data) ? result.data[0] : result.data
                                                      if (inserted) {
                                                        setMessagesList((prev) => prev.map((item) => {
                                                          if (String(item.id) !== String(optimisticMessage.id)) return item
                                                          return {
                                                            ...(inserted as SupportTicket),
                                                            convoId: item.convoId,
                                                          } as SupportTicket & { convoId?: string }
                                                        }))
                                                      }
                                                    } catch (err) {
                                                      console.error("Failed to send chat message:", err)
                                                    }
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

                                                  function openGuideInquiry(productName: string | null, brand?: string | null) {
                                                    const normalizedProductName = productName ?? "this product"
                                                    const normalizedBrand = brand ?? ""
                                                    const displayName = normalizedBrand ? `${normalizedProductName} (${normalizedBrand})` : normalizedProductName
                                                    setGuideInquiry({
                                                      isOpen: true,
                                                      title: `Ask about ${displayName}`,
                                                      message: `I want to ask about ${displayName}`,
                                                    })
                                                  }

                                                  async function submitSupportTicket(e?: React.FormEvent | null, overrides?: { category?: string; message?: string; nextView?: string }) {
                                                    if (e) e.preventDefault()

                                                    const category = overrides?.category ?? supportCategory
                                                    const message = (overrides?.message ?? supportMessage).trim()
                                                    if (!message) return

                                                    const conversationId = `support-${Date.now()}`
                                                    const conversationSubject = category
                                                    const optimisticTicket: SupportTicket = {
                                                      id: `local-${Date.now()}`,
                                                      user_id: profile.id,
                                                      user_email: profile.email || "",
                                                      subject: conversationSubject,
                                                      message,
                                                      status: "open",
                                                      created_at: new Date().toISOString(),
                                                    }

                                                    const annotatedTicket = { ...optimisticTicket, convoId: conversationId } as SupportTicket & { convoId: string }
                                                    setSupportCategory(category)
                                                    setSupportMessage("")
                                                    setSupportTickets((prev) => [annotatedTicket, ...prev])
                                                    setSupportStatus("Success! System routing confirmation generated.")
                                                    setMessagesList((prev) => [...prev, annotatedTicket])
                                                    setSelectedConvoId(conversationId)
                                                    setSelectedMessageId(String(annotatedTicket.id))
                                                    setActive(overrides?.nextView ?? "messages")
                                                    showToast("Message sent successfully")

                                                    try {
                                                      const response = await fetch("/api/support", {
                                                        method: "POST",
                                                        credentials: "same-origin",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                          subject: conversationSubject,
                                                          message,
                                                        }),
                                                      })

                                                      const result = await handleJsonResponse(response)
                                                      if (!response.ok) {
                                                        return
                                                      }

                                                      const inserted = Array.isArray(result.data) ? result.data[0] : result.data
                                                      if (inserted) {
                                                        setSupportTickets((prev) => prev.map((item) => item.id === optimisticTicket.id ? (inserted as SupportTicket) : item))
                                                        setMessagesList((prev) => prev.map((item) => {
                                                          if (String(item.id) !== String(optimisticTicket.id)) return item
                                                          return {
                                                            ...(inserted as SupportTicket),
                                                            convoId: item.convoId,
                                                          } as SupportTicket & { convoId?: string }
                                                        }))
                                                      }
                                                    } catch (err) {
                                                      console.error("❌ Support Ticket Exception:", err)
                                                    }
                                                  }

                                                  

                                                  async function insertBookingRecord(sessionId: string | number) {
                                                    const { data, error } = await supabase
                                                      .from("bookings")
                                                      .insert({ user_id: profile.id, session_id: sessionId, status: "confirmed" })
                                                      .select()
                                                      .single()

                                                    if (error) {
                                                      if (error.code === "23505" || error.message?.toLowerCase().includes("duplicate")) {
                                                        const { data: existingBooking, error: lookupError } = await supabase
                                                          .from("bookings")
                                                          .select("*")
                                                          .eq("user_id", profile.id)
                                                          .eq("session_id", sessionId)
                                                          .maybeSingle()

                                                        if (!lookupError && existingBooking) return existingBooking
                                                      }

                                                      throw error
                                                    }

                                                    return data
                                                  }

                                                  async function book(session: ScheduleSession) {
                                                    setPendingId(session.id)
                                                    try {
                                                      const response = await fetch("/api/bookings", {
                                                        method: "POST",
                                                        credentials: "same-origin",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ session_id: session.id }),
                                                      })

                                                      const result = await handleJsonResponse(response)
                                                      let inserted = Array.isArray(result.data) ? result.data[0] : result.data

                                                      if (response.ok && inserted) {
                                                        setBookings((prev) => [...prev, inserted as Booking])
                                                        alert("✓ You've successfully joined the session!")
                                                        return
                                                      }

                                                      console.warn("⚠️ Booking API failed; attempting client-side fallback", { status: response.status, result })

                                                      try {
                                                        const clientInserted = await insertBookingRecord(session.id)
                                                        if (clientInserted) {
                                                          setBookings((prev) => [...prev, clientInserted as Booking])
                                                          alert("✓ You've successfully joined the session!")
                                                          return
                                                        }

                                                        const { data: refreshed, error: refreshError } = await supabase.from("bookings").select("*").eq("user_id", profile.id)
                                                        if (!refreshError && refreshed) setBookings(refreshed as Booking[])
                                                      } catch (fallbackErr) {
                                                        console.error("❌ Booking fallback failed:", fallbackErr)
                                                      }

                                                      alert(`Error joining session: ${result.error || "Unknown error"}`)
                                                    } catch (err) {
                                                      console.error("❌ Booking Exception:", err)
                                                      alert(`Failed to join session: ${err instanceof Error ? err.message : "Unknown error"}`)
                                                    } finally {
                                                      setPendingId(null)
                                                    }
                                                  }

                                                  async function handlePurchaseRequest(item: ShopItem) {
                                                    showConfirmation(
                                                      "Purchase Request",
                                                      `Send a request for \"${item.name}\" to the team leader? Instagram will also be opened for direct DM.`,
                                                      async () => {
                                                        setConfirmLoading(true)
                                                        try {
                                                          const conversationId = `purchase-${Date.now()}`
                                                          const conversationSubject = `Purchase Request: ${item.name}`
                                                          const optimisticTicket: SupportTicket = {
                                                            id: `local-${Date.now()}`,
                                                            user_id: profile.id,
                                                            user_email: profile.email || "",
                                                            subject: conversationSubject,
                                                            message: `Member ${displayName} requests to purchase ${item.name} (${item.category}). Please follow up via Instagram.`,
                                                            status: "open",
                                                            created_at: new Date().toISOString(),
                                                          }
                                                          const annotatedTicket = { ...optimisticTicket, convoId: conversationId } as SupportTicket & { convoId: string }
                                                          setSupportTickets((prev) => [annotatedTicket, ...prev])
                                                          setMessagesList((prev) => [...prev, annotatedTicket])
                                                          setSelectedConvoId(conversationId)
                                                          setSelectedMessageId(String(annotatedTicket.id))
                                                          setActive("messages")

                                                          const response = await fetch("/api/support", {
                                                            method: "POST",
                                                            credentials: "same-origin",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                              subject: conversationSubject,
                                                              message: `Member ${displayName} requests to purchase ${item.name} (${item.category}). Please follow up via Instagram.`,
                                                            }),
                                                          })

                                                          const result = await handleJsonResponse(response)
                                                          if (!response.ok) {
                                                            console.warn("Purchase request API returned an error, but continuing to open Instagram:", result)
                                                          }

                                                          showToast("✓ Purchase request sent. Opening Instagram...")
                                                          window.open("https://instagram.com/wolvesbadminton", "_blank")
                                                        } finally {
                                                          setConfirmLoading(false)
                                                        }
                                                      },
                                                    )
                                                  }

                                                  async function deleteBookingRemotely(booking: Booking) {
                                                    const payload = {
                                                      booking_id: booking.id,
                                                      session_id: booking.session_id,
                                                      user_id: profile.id,
                                                    }

                                                    const response = await fetch("/api/bookings", {
                                                      method: "DELETE",
                                                      credentials: "same-origin",
                                                      headers: { "Content-Type": "application/json" },
                                                      body: JSON.stringify(payload),
                                                    })

                                                    const result = await handleJsonResponse(response)
                                                    if (response.ok) {
                                                      return { ok: true as const, result }
                                                    }

                                                    return { ok: false as const, result, status: response.status }
                                                  }

                                                  async function deleteBookingDirectly(booking: Booking) {
                                                    if (!booking.id && !booking.session_id) {
                                                      return { ok: false as const, error: "Booking details unavailable" }
                                                    }

                                                    const attempts = [] as Array<() => Promise<{ data: unknown; error: unknown }>>

                                                    if (booking.id) {
                                                      attempts.push(async () => {
                                                        const { data, error } = await supabase.from("bookings").delete().eq("id", booking.id).select()
                                                        return { data, error }
                                                      })
                                                    }

                                                    if (booking.session_id && profile.id) {
                                                      attempts.push(async () => {
                                                        const { data, error } = await supabase.from("bookings").delete().eq("session_id", booking.session_id).eq("user_id", profile.id).select()
                                                        return { data, error }
                                                      })
                                                    }

                                                    for (const attempt of attempts) {
                                                      const { data, error } = await attempt()
                                                      if (!error && Array.isArray(data) && data.length > 0) {
                                                        return { ok: true as const, data }
                                                      }
                                                      if (error) {
                                                        console.error("Direct booking delete failed:", error)
                                                      }
                                                    }

                                                    return { ok: false as const, error: "Unable to retract booking from the database" }
                                                  }

                                                  async function cancel(booking: Booking) {
                                                    const sessionDetail = booking.session_id ? scheduleById.get(String(booking.session_id)) : null
                                                    const sessionInfo = sessionDetail ? `${formatDate(sessionDetail.date)} at ${sessionDetail.time || "TBD"}` : "this session"
                                                    
                                                    showConfirmation(
                                                      "Retract Spot?",
                                                      `Remove your booking from ${sessionInfo}?`,
                                                      async () => {
                                                        setConfirmLoading(true)
                                                        try {
                                                          const apiResult = await deleteBookingRemotely(booking)
                                                          if (apiResult.ok) {
                                                            setBookings((prev) => prev.filter((b) => b.id !== booking.id))
                                                            closeConfirmation()
                                                            showToast("✓ Booking retracted successfully")
                                                            return
                                                          }

                                                          const directResult = await deleteBookingDirectly(booking)
                                                          if (directResult.ok) {
                                                            setBookings((prev) => prev.filter((b) => b.id !== booking.id))
                                                            closeConfirmation()
                                                            showToast("✓ Booking retracted successfully")
                                                            return
                                                          }

                                                          console.error("❌ Cancel Booking Error:", apiResult.result)
                                                          alert(`Error retracting booking: ${apiResult.result?.error || directResult.error || "Unknown error"}`)
                                                        } finally {
                                                          setConfirmLoading(false)
                                                        }
                                                      }
                                                    )
                                                  }

                                                  async function toggleAttendance(id: string, nextStatus: "present" | "absent" | "late") {
                                                    const { error } = await supabase.from("attendance").update({ status: nextStatus }).eq("id", id)
                                                    if (!error) {
                                                      setAttendanceList((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)))
                                                    }
                                                  }

                                                  

                                                async function cleanupExpiredBookings() {
                                                  const expiredBookingIds: string[] = []
                                                  
                                                  bookings.forEach((booking) => {
                                                    // Convert to string safely to match Map<string, ScheduleSession>
                                                    const sessionIdStr = booking.session_id ? booking.session_id.toString() : ""
                                                    const session = sessionIdStr ? scheduleById.get(sessionIdStr) : undefined
                                                    
                                                    // If the session doesn't exist at all, or if it's expired, mark it for cleanup
                                                    if (!session || isSessionExpired(session)) {
                                                      expiredBookingIds.push(booking.id)
                                                    }
                                                  })
                                                  
                                                  if (expiredBookingIds.length > 0) {
                                                    // Delete expired bookings from database
                                                    for (const bookingId of expiredBookingIds) {
                                                      await supabase.from("bookings").delete().eq("id", bookingId)
                                                    }
                                                    // Update local state
                                                    setBookings((prev) => prev.filter((b) => !expiredBookingIds.includes(b.id)))
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

                                                  // Auto-cleanup expired bookings every minute
                                                  useEffect(() => {
                                                    cleanupExpiredBookings()
                                                    const interval = setInterval(cleanupExpiredBookings, 60000) // Check every 60 seconds
                                                    return () => clearInterval(interval)
                                                  }, [bookings, schedule])

                                                  // Fetch resources when resources tab is active
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
                                                      } catch (err) {
                                                        console.error("Failed to load resources:", err)
                                                      }
                                                    })()
                                                    return () => { mounted = false }
                                                  }, [active])

                                                  // Set up real-time listener for attendance updates
                                                  useEffect(() => {
                                                    let channel: any
                                                    try {
                                                      channel = supabase
                                                        .channel(`attendance:user:${profile.id}`)
                                                        .on(
                                                          "postgres_changes",
                                                          {
                                                            event: "*",
                                                            schema: "public",
                                                            table: "attendance",
                                                            filter: `user_id=eq.${profile.id}`,
                                                          },
                                                          (payload: any) => {
                                                            console.log("Attendance update received:", payload)
                                                            const newRecord = payload.new as AttendanceRecord
                                                            if (newRecord) {
                                                              setAttendanceList((prev) => {
                                                                // Check if record already exists
                                                                const exists = prev.some((r) => r.id === newRecord.id)
                                                                if (exists) {
                                                                  // Update existing record
                                                                  return prev.map((r) => (r.id === newRecord.id ? newRecord : r))
                                                                } else {
                                                                  // Add new record at the top
                                                                  return [newRecord, ...prev]
                                                                }
                                                              })
                                                            }
                                                          },
                                                        )
                                                        .subscribe()
                                                    } catch (err) {
                                                      console.error("Failed to subscribe to attendance updates:", err)
                                                    }

                                                    return () => {
                                                      if (channel) {
                                                        supabase.removeChannel(channel)
                                                      }
                                                    }
                                                  }, [profile.id, supabase])

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
                                                                <StatCard icon={Ticket} label="Active Bookings" value={visibleBookings.length} theme={theme} />
                                                                <StatCard icon={CalendarDays} label="Upcoming Sessions" value={visibleSchedule.length} theme={theme} />
                                                                <Card className={`p-4 border ${theme.cardBorder} ${theme.cardBg} rounded-sm flex items-start gap-4`}>
                                                                  <div className="p-2.5 rounded-sm bg-[#E2AC28]/10 text-[#E2AC28]">
                                                                    <CalendarDays className="h-5 w-5" />
                                                                  </div>
                                                                  <div>
                                                                    <p className={`text-[10px] font-mono uppercase tracking-wider ${theme.textMuted}`}>Next Session</p>
                                                                    {visibleSchedule.length > 0 ? (
                                                                      <>
                                                                        <p className="text-sm font-semibold mt-1">{visibleSchedule[0].title || "Untitled Session"}</p>
                                                                        <p className="text-xs text-zinc-400">{formatDate(visibleSchedule[0].date)} · {visibleSchedule[0].time || "TBD"}</p>
                                                                      </>
                                                                    ) : (
                                                                      <p className="text-sm text-zinc-400 mt-1">No upcoming sessions</p>
                                                                    )}
                                                                  </div>
                                                                </Card>
                                                              </div>

                                                              {announcements.length > 0 && (
                                                                <Card className={`p-6 bg-gradient-to-br from-[#E2AC28]/10 to-[#E2AC28]/5 border border-[#E2AC28]/30 rounded-sm`}>
                                                                  <div className="flex items-start gap-4">
                                                                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-[#E2AC28]/20`}>
                                                                      <Megaphone className="h-6 w-6 text-[#E2AC28]" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                      <p className="text-xs font-semibold text-[#E2AC28] uppercase tracking-wide">Latest Announcement</p>
                                                                      <h3 className={`mt-2 text-2xl font-bold ${theme.headingColor}`}>{announcements[0].title}</h3>
                                                                      <p className={`mt-3 text-base leading-relaxed ${theme.textPrimary} whitespace-pre-line`}>
                                                                        {announcements[0].content}
                                                                      </p>
                                                                      <p className={`mt-3 text-xs ${theme.textSecondary}`}>
                                                                        Posted {formatDate(announcements[0].created_at)}
                                                                      </p>
                                                                    </div>
                                                                  </div>
                                                                </Card>
                                                              )}
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
                                                                    {visibleSchedule.map((s) => {
                                                  const booked = bookedSessionIds.has(String(s.id))
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
                                                        type="button"
                                                        disabled={booked || pendingId === String(s.id)}
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
                                                                        type="button"
                                                                        disabled={pendingId !== null}
                                                                        onClick={() => setConfirmingSession(null)}
                                                                        className="px-4 py-2 text-xs font-mono uppercase tracking-wide text-zinc-400 hover:text-white transition-colors"
                                                                      >
                                                                        Cancel
                                                                      </button>
                                                                      <Button
                                                                        type="button"
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
                                                                    const s = b.session_id ? scheduleById.get(String(b.session_id)) : null
                                                                    return (
                                                                      <Card key={b.id} className={`flex flex-col gap-3 p-4 ${theme.cardBorder} ${theme.cardBg} rounded-sm sm:flex-row sm:items-center sm:justify-between`}>
                                                                        <div>
                                                                          <p className={`text-sm font-bold ${theme.headingColor} uppercase`}>{s ? formatDate(s.date) : "Training Interval"} {s?.time && `· ${s.time}`}</p>
                                                                          {s?.title && <p className="text-xs font-mono text-zinc-400 mt-0.5">Focus: {s.title}</p>}
                                                                        </div>
                                                                        <Button type="button" size="sm" onClick={() => cancel(b)} className="border border-zinc-500 bg-transparent text-xs uppercase text-red-400 font-mono rounded-sm">Retract Spot</Button>
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
                                                                          {as.score != null && <span className="text-[11px] font-mono text-zinc-300 mt-0.5">Rating Evaluation Score: {as.score}/100</span>}
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

                                                          {/* MEMBER ATTENDANCE HISTORY */}
                                                          {active === "attendance" && !isStaff && (
                                                            <div>
                                                              <div className="mb-6">
                                                                <h2 className={`text-lg font-semibold ${theme.headingColor}`}>Your Attendance</h2>
                                                                <p className={`text-sm ${theme.textMuted}`}>View your session attendance and check-in history</p>
                                                              </div>

                                                              {/* Filter Buttons */}
                                                              <div className="mb-4 flex flex-wrap gap-2">
                                                                {(["all", "present", "absent", "late"] as const).map((filterOpt) => (
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

                                                              {/* Attendance Records */}
                                                              <div className="flex flex-col gap-3">
                                                                {filteredAttendance.length === 0 ? (
                                                                  <Card className="p-6 text-center">
                                                                    <p className={theme.textMuted}>No attendance records found for the selected filter.</p>
                                                                  </Card>
                                                                ) : (
                                                                  <div className="grid grid-cols-1 gap-3">
                                                                    {filteredAttendance.map((record) => {
                                                                      const statusColor = 
                                                                        record.status === "present" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                                                        : record.status === "absent" ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                                                        : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                                                      
                                                                      return (
                                                                        <Card key={record.id} className={`p-4 border ${statusColor}`}>
                                                                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                                            <div>
                                                                              <p className="font-semibold text-sm">{record.user_name}</p>
                                                                              <p className={`text-xs ${theme.textMuted} mt-1`}>Session: {record.session_id.substring(0, 8)}</p>
                                                                              <p className={`text-xs ${theme.textMuted}`}>Level: {record.user_level}</p>
                                                                            </div>
                                                                            <div className="flex flex-col sm:items-end gap-2">
                                                                              <Badge className={statusColor}>
                                                                                {record.status.toUpperCase()}
                                                                              </Badge>
                                                                              <p className={`text-xs ${theme.textMuted}`}>
                                                                                {record.marked_at ? new Date(record.marked_at).toLocaleString() : "Not marked"}
                                                                              </p>
                                                                            </div>
                                                                          </div>
                                                                        </Card>
                                                                      )
                                                                    })}
                                                                  </div>
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
                                                              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div>
                                                                  <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Pro Recommended Equipment</h2>
                                                                  <p className="text-[11px] text-zinc-500 mt-1">Filter by category or search text to find the right gear faster.</p>
                                                                </div>
                                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                                  <select
                                                                    value={gearFilter}
                                                                    onChange={(e) => setGearFilter(e.target.value)}
                                                                    className={`rounded-sm border px-3 py-2 text-xs ${theme.inputBg}`}
                                                                  >
                                                                    {gearCategories.map((category) => (
                                                                      <option key={category} value={category}>{category}</option>
                                                                    ))}
                                                                  </select>
                                                                  <select
                                                                    value={gearTierFilter}
                                                                    onChange={(e) => setGearTierFilter(e.target.value)}
                                                                    className={`rounded-sm border px-3 py-2 text-xs ${theme.inputBg}`}
                                                                  >
                                                                    {gearTierOptions.map((level) => (
                                                                      <option key={level} value={level}>{level}</option>
                                                                    ))}
                                                                  </select>
                                                                  <input
                                                                    type="search"
                                                                    value={gearSearch}
                                                                    onChange={(e) => setGearSearch(e.target.value)}
                                                                    placeholder="Search equipment..."
                                                                    className={`rounded-sm border px-3 py-2 text-xs ${theme.inputBg}`}
                                                                  />
                                                                </div>
                                                              </div>
                                                              {filteredGearGuides.length === 0 ? (
                                                                <Card className={`p-6 ${theme.cardBorder} ${theme.cardBg}`}>
                                                                  <p className={`text-sm ${theme.textSecondary}`}>No equipment guides match that filter.</p>
                                                                </Card>
                                                              ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                  {filteredGearGuides.map((g) => {
                                                                    const imageUrl = g.image_url || (g as any).pic_url || null
                                                                    return (
                                                                      <Card key={g.id} className={`p-5 ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col justify-between gap-4`}>
                                                                        <div>
                                                                          <div className="flex items-start gap-4">
                                                                            <div className="h-32 w-32 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
                                                                              {imageUrl ? (
                                                                                <img src={imageUrl} alt={g.title} className="h-full w-full object-cover" />
                                                                              ) : (
                                                                                <div className="flex h-full items-center justify-center text-[12px] text-zinc-500">No image</div>
                                                                              )}
                                                                            </div>
                                                                            <div className="flex-1">
                                                                              <div className="flex items-center justify-between gap-3">
                                                                                <div>
                                                                                  <h4 className={`text-base font-bold ${theme.headingColor}`}>{g.title}</h4>
                                                                                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-1">{g.category || "Gear"}</p>
                                                                                </div>
                                                                                <Badge className="bg-[#E2AC28]/10 text-[#E2AC28] text-[10px] px-2 py-1 rounded-sm uppercase">{g.recommended_for_tier}</Badge>
                                                                              </div>
                                                                              <p className="text-xs text-zinc-400 mt-2">{g.brand}</p>
                                                                            </div>
                                                                          </div>
                                                                          <div className="mt-4 space-y-2 text-sm">
                                                                            <p className={`font-semibold ${theme.headingColor}`}>Specs</p>
                                                                            <p className={`text-xs ${theme.textSecondary}`}>{g.specs}</p>
                                                                            <p className={`font-semibold ${theme.headingColor}`}>Why we recommend it</p>
                                                                            <p className={`text-xs ${theme.textSecondary} leading-relaxed`}>{g.why_recommend}</p>
                                                                          </div>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                          {g.external_link && (
                                                                            <a href={g.external_link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#E2AC28] hover:underline">
                                                                              View product page
                                                                            </a>
                                                                          )}
                                                                          <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => openGuideInquiry(g.title, g.brand)}
                                                                            className="border-[#E2AC28]/30 bg-[#E2AC28]/10 text-[#E2AC28] hover:bg-[#E2AC28]/20"
                                                                          >
                                                                            <SendHorizonal className="h-3.5 w-3.5" />
                                                                            Ask about this guide
                                                                          </Button>
                                                                        </div>
                                                                        {isStaff && (
                                                                          <div className="mt-2 pt-3 border-t border-zinc-800/40">
                                                                            <div className="flex items-center gap-2">
                                                                              <Image className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                                                              <input
                                                                                type="text"
                                                                                placeholder="Update Gear Image Link URL..."
                                                                                defaultValue={g.image_url || ""}
                                                                                onBlur={(e) => handleUpdateAssetLink("equipment_recommendations", g.id, "image_url", e.target.value)}
                                                                                className={`w-full px-2 py-0.5 text-[10px] font-mono rounded-sm border outline-none ${theme.inputBg}`}
                                                                              />
                                                                            </div>
                                                                          </div>
                                                                        )}
                                                                      </Card>
                                                                    )
                                                                  })}
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}

                                                          {/* WOLVES SHOP MODULE */}
                                                          {active === "shop" && (
                                                            <div>
                                                              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div>
                                                                  <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Wolves Merch & Equipment Store</h2>
                                                                  <p className="text-[11px] text-zinc-500 mt-1">Filter by category or name to find the right item quickly.</p>
                                                                </div>
                                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                                  <select
                                                                    value={shopFilter}
                                                                    onChange={(e) => setShopFilter(e.target.value)}
                                                                    className={`rounded-sm border px-3 py-2 text-xs ${theme.inputBg}`}
                                                                  >
                                                                    {shopCategories.map((category) => (
                                                                      <option key={category} value={category}>{category}</option>
                                                                    ))}
                                                                  </select>
                                                                  <input
                                                                    type="search"
                                                                    value={shopSearch}
                                                                    onChange={(e) => setShopSearch(e.target.value)}
                                                                    placeholder="Search shop items..."
                                                                    className={`rounded-sm border px-3 py-2 text-xs ${theme.inputBg}`}
                                                                  />
                                                                  <div className="flex gap-2">
                                                                    <input
                                                                      type="number"
                                                                      min={0}
                                                                      value={shopPriceMin}
                                                                      onChange={(e) => setShopPriceMin(e.target.value === "" ? "" : Number(e.target.value))}
                                                                      placeholder="Min $"
                                                                      className={`rounded-sm border px-3 py-2 text-xs ${theme.inputBg} w-24`}
                                                                    />
                                                                    <input
                                                                      type="number"
                                                                      min={0}
                                                                      value={shopPriceMax}
                                                                      onChange={(e) => setShopPriceMax(e.target.value === "" ? "" : Number(e.target.value))}
                                                                      placeholder="Max $"
                                                                      className={`rounded-sm border px-3 py-2 text-xs ${theme.inputBg} w-24`}
                                                                    />
                                                                  </div>
                                                                </div>
                                                              </div>
                                                              {filteredShopItems.length === 0 ? (
                                                                <Card className={`p-6 ${theme.cardBorder} ${theme.cardBg}`}>
                                                                  <p className={`text-sm ${theme.textSecondary}`}>No shop items match that filter.</p>
                                                                </Card>
                                                              ) : (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                                  {filteredShopItems.map((item) => {
                                                                    const img = item.image_url || (item as any).pic_url || (item as any).picUrl || null
                                                                    const unit = item.unit || (item as any).unit || "units"
                                                                    return (
                                                                      <Card key={item.id} className={`p-4 ${theme.cardBorder} ${theme.cardBg} rounded-sm flex flex-col justify-between gap-3`}>
                                                                        <div className="flex gap-3">
                                                                          {img ? (
                                                                            <div className="h-32 w-32 shrink-0 bg-zinc-950/30 rounded-sm overflow-hidden border border-zinc-800">
                                                                              <img src={img} alt={item.name || "product"} className="w-full h-full object-cover" />
                                                                            </div>
                                                                          ) : (
                                                                            <div className="h-32 w-32 shrink-0 bg-zinc-950/30 rounded-sm flex items-center justify-center border border-zinc-800">
                                                                              <span className="text-[12px] text-zinc-500">No image</span>
                                                                            </div>
                                                                          )}
                                                                          <div className="flex-1">
                                                                            <div className="flex justify-between items-start gap-2">
                                                                              <div>
                                                                                <h4 className={`text-sm font-bold ${theme.headingColor}`}>{item.name}</h4>
                                                                                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-1">{item.category || "Item"}</p>
                                                                              </div>
                                                                              <span className="text-xs font-mono font-bold text-[#E2AC28]">${item.price ?? 0}</span>
                                                                            </div>
                                                                            <p className={`text-xs ${theme.textSecondary} mt-2 leading-relaxed`}>{item.description || "No description available."}</p>
                                                                          </div>
                                                                        </div>
                                                                        <div className="flex items-center justify-between border-t border-zinc-800/30 pt-2 mt-1 text-[10px] text-zinc-400">
                                                                          <span>Stock: {item.stock ?? 0} {unit}</span>
                                                                          <span>{unit}</span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2 mt-3">
                                                                          <Button
                                                                            size="sm"
                                                                            onClick={() => openGuideInquiry(item.name, item.category ?? "Shop Item")}
                                                                            className="bg-[#E2AC28] text-black text-[10px] font-mono uppercase px-3 py-1 rounded-sm border-none"
                                                                          >
                                                                            Request Purchase
                                                                          </Button>
                                                                          <button
                                                                            type="button"
                                                                            onClick={() => window.open("https://instagram.com", "_blank", "noopener,noreferrer")}
                                                                            className="inline-flex items-center justify-center rounded-sm border border-[#E2AC28]/30 bg-[#E2AC28]/10 px-3 py-1 text-[10px] font-mono uppercase text-[#E2AC28]"
                                                                          >
                                                                            Open Instagram DM
                                                                          </button>
                                                                        </div>
                                                                      </Card>
                                                                    )
                                                                  })}
                                                                </div>
                                                              )}
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

                                                          {/* RUBRICS & PDFS SECTION */}
                                                          {active === "resources" && (
                                                            <div>
                                                              <div className="mb-6">
                                                                <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Rubrics & Assessment PDFs</h2>
                                                                <p className="text-[11px] text-zinc-500 mt-1">View and download rubrics, assessment guides, and other learning resources shared by your coaches.</p>
                                                              </div>

                                                              {resources.length === 0 ? (
                                                                <Card className={`p-6 text-center ${theme.cardBorder} ${theme.cardBg}`}>
                                                                  <p className={`${theme.textSecondary}`}>No resources available yet. Check back soon!</p>
                                                                </Card>
                                                              ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                  {resources.map((resource) => (
                                                                    <Card key={resource.id} className={`p-4 ${theme.cardBorder} ${theme.cardBg} flex flex-col justify-between gap-3`}>
                                                                      <div>
                                                                        <h3 className="font-medium text-foreground">{resource.title}</h3>
                                                                        <p className="text-xs text-muted-foreground mt-2">
                                                                          Posted {new Date(resource.created_at).toLocaleDateString()}
                                                                        </p>
                                                                      </div>
                                                                      <Button
                                                                        onClick={() => window.open(resource.url || "", "_blank")}
                                                                        className="w-full"
                                                                        size="sm"
                                                                      >
                                                                        View PDF
                                                                      </Button>
                                                                    </Card>
                                                                  ))}
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}

                                                          {/* CONTACT & SUPPORT HUB */}
                                                          {active === "messages" && (
                                                            <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5">
                                                              <div className={`rounded-2xl border ${theme.cardBorder} ${theme.cardBg} p-4 flex flex-col gap-3`}>
                                                                <div>
                                                                    <div className="flex items-center gap-3">
                                                                      <h2 className={`text-xs font-bold uppercase tracking-widest ${theme.textSecondary}`}>Chats</h2>
                                                                    </div>
                                                                    <p className="text-[11px] text-zinc-500 mt-1">Continuous support conversations with the club team.</p>
                                                                </div>

                                                                <div className="flex flex-col gap-2 w-full">
                                                                  {(() => {
                                                                    const convos = orderedConversations
                                                                    if (convos.length === 0) {
                                                                      return (
                                                                        <div className="max-w-full rounded-xl border p-3 text-left bg-zinc-950/70">
                                                                          <p className="text-sm font-semibold text-white">Club Support</p>
                                                                          <p className="text-[11px] text-zinc-500 mt-1">Start a new chat with the team.</p>
                                                                        </div>
                                                                      )
                                                                    }

                                                                    return convos.map((c) => {
                                                                      const isSelected = selectedConvoId === (c.convoId ?? c.subject ?? '_')
                                                                      return (
                                                                        <button
                                                                          key={c.id}
                                                                          type="button"
                                                                          onClick={() => {
                                                                            setSelectedConvoId(c.convoId ?? c.subject ?? '_')
                                                                            setSelectedMessageId(c.id ? String(c.id) : null)
                                                                          }}
                                                                          className={`w-full text-left rounded-xl border p-3 transition ${isSelected ? 'border-[#E2AC28] bg-zinc-900' : 'border-zinc-800 bg-zinc-950/70'}`}
                                                                        >
                                                                          <div className="flex items-center justify-between gap-2">
                                                                            <p className="text-sm font-semibold text-white">{c.subject || 'Club Support'}</p>
                                                                            <Badge className={`text-[10px] px-2 py-1 ${c.status === 'resolved' ? 'bg-green-600/20 text-green-500' : 'bg-yellow-600/20 text-yellow-500'}`}>
                                                                              {c.status || 'open'}
                                                                            </Badge>
                                                                          </div>
                                                                          <p className="text-[11px] text-zinc-500 mt-1 truncate">{c.message}</p>
                                                                        </button>
                                                                      )
                                                                    })
                                                                  })()}
                                                                </div>
                                                              </div>

                                                            <div className={`flex min-h-[620px] max-h-[760px] flex-col overflow-hidden rounded-2xl border ${theme.cardBorder} ${theme.cardBg}`}>
                                                                <div className="border-b border-zinc-800/70 bg-zinc-950/60 px-4 py-4 shrink-0">
                                                                  <div className="flex items-center justify-between gap-3">
                                                                    <div className="flex items-center gap-3">
                                                                      <div>
                                                                        <h3 className="text-sm font-bold text-white">Club Support</h3>
                                                                        <p className="text-[11px] text-zinc-500">Usually replies in a few minutes</p>
                                                                      </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                                                                      <span className="h-2 w-2 rounded-full bg-emerald-400" /> Online
                                                                    </div>
                                                                  </div>
                                                                </div>


                                                                <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(226,172,40,0.08),_transparent_50%)] p-4" data-messages-scroll-container>
                                                                  {(() => {
                                                                    const visible = selectedConvoId ? messagesList.filter((m) => m.convoId === selectedConvoId) : messagesList
                                                                    if (visible.length === 0) {
                                                                      return (
                                                                        <div className="flex h-full items-center justify-center">
                                                                          <div className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-center text-sm text-zinc-300">
                                                                            Start a chat and we’ll keep everything in one continuous conversation.
                                                                          </div>
                                                                        </div>
                                                                      )
                                                                    }

                                                                    return (
                                                                      <div className="space-y-3">
                                                                        {visible.map((message, index) => {
                                                                          const isMine = message.user_id === profile.id || message.user_email === profile.email
                                                                          const prevMessage = index > 0 ? visible[index - 1] : null
                                                                          const showDateSeparator = !prevMessage || new Date(prevMessage.created_at).toDateString() !== new Date(message.created_at).toDateString()
                                                                          return (
                                                                            <div key={message.id}>
                                                                              {showDateSeparator && (
                                                                                <div className="flex justify-center py-2 mb-2">
                                                                                  <p className="text-[11px] text-zinc-500 font-medium bg-zinc-900/50 px-3 py-1 rounded-full">
                                                                                    {new Date(message.created_at).toLocaleDateString()}
                                                                                  </p>
                                                                                </div>
                                                                              )}
                                                                              <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                                                                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isMine ? "bg-[#E2AC28] text-black" : "border border-zinc-800 bg-zinc-900 text-zinc-100"}`}>
                                                                                  <p className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${isMine ? "text-black/70" : "text-zinc-400"}`}>
                                                                                    {isMine ? "You" : "Club support"}
                                                                                  </p>
                                                                                  <p className="mt-1 whitespace-pre-line text-sm">{message.message}</p>
                                                                                  <p className={`mt-2 text-[10px] ${isMine ? "text-black/60" : "text-zinc-500"}`}>
                                                                                    {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                                                                  </p>
                                                                                </div>
                                                                              </div>
                                                                            </div>
                                                                          )
                                                                        })}
                                                                        <div ref={messagesEndRef} />
                                                                      </div>
                                                                    )
                                                                  })()}
                                                                </div>

                                                                <div className="border-t border-zinc-800/70 bg-zinc-950/70 p-4 shrink-0 mt-0">
                                                                  <form onSubmit={sendChatMessage} className="flex items-end gap-2">
                                                                    <textarea
                                                                      rows={2}
                                                                      value={chatInput}
                                                                      onChange={(e) => setChatInput(e.target.value)}
                                                                      onKeyPress={(e) => {
                                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                                          e.preventDefault()
                                                                          sendChatMessage(e as any)
                                                                        }
                                                                      }}
                                                                      className={`flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ${theme.inputBg}`}
                                                                      placeholder="Type a message..."
                                                                    />
                                                                    <Button type="submit" size="sm" className="h-10 w-10 rounded-full bg-[#E2AC28] p-0 text-black hover:bg-[#d4a428]">
                                                                      <SendHorizonal className="h-4 w-4" />
                                                                    </Button>
                                                                  </form>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          )}
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

                                                                {/* Open Tickets Ledger removed per request */}
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
                                                      <GuideInquiryModal
                                                        isOpen={guideInquiry.isOpen}
                                                        title={guideInquiry.title}
                                                        message={guideInquiry.message}
                                                        onChange={(value) => setGuideInquiry((prev) => ({ ...prev, message: value }))}
                                                        onCancel={() => setGuideInquiry({ isOpen: false, title: "", message: "" })}
                                                        onSend={() => {
                                                          if (!guideInquiry.message.trim()) return
                                                          submitSupportTicket(null, {
                                                            category: "Equipment Guide Info",
                                                            message: guideInquiry.message,
                                                            nextView: "messages",
                                                          })
                                                          setGuideInquiry({ isOpen: false, title: "", message: "" })
                                                        }}
                                                      />
                                                      <ConfirmationDialog
                                                        isOpen={confirmState.isOpen}
                                                        title={confirmState.title}
                                                        message={confirmState.message}
                                                        onConfirm={confirmState.onConfirm}
                                                        onCancel={closeConfirmation}
                                                        isLoading={confirmLoading}
                                                      />
                                                      <Toast
                                                        isOpen={toast.isOpen}
                                                        message={toast.message}
                                                      />
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

                                                function GuideInquiryModal({
                                                  isOpen,
                                                  title,
                                                  message,
                                                  onChange,
                                                  onCancel,
                                                  onSend,
                                                }: {
                                                  isOpen: boolean
                                                  title: string
                                                  message: string
                                                  onChange: (value: string) => void
                                                  onCancel: () => void
                                                  onSend: () => void
                                                }) {
                                                  if (!isOpen) return null

                                                  return (
                                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                                      <Card className="w-full max-w-lg mx-4 p-6 shadow-xl border-zinc-800/60">
                                                        <h2 className="text-lg font-bold text-foreground">{title}</h2>
                                                        <p className="mt-2 text-sm text-muted-foreground">Write your question below and we’ll send it to the support team.</p>
                                                        <textarea
                                                          value={message}
                                                          onChange={(e) => onChange(e.target.value)}
                                                          rows={5}
                                                          className="mt-4 w-full rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none"
                                                        />
                                                        <div className="mt-6 flex justify-end gap-3">
                                                          <Button type="button" variant="outline" onClick={onCancel} className="px-4">
                                                            Cancel
                                                          </Button>
                                                          <Button type="button" onClick={onSend} className="px-4 bg-[#E2AC28] text-black hover:bg-[#E2AC28]/90">
                                                            Send
                                                          </Button>
                                                        </div>
                                                      </Card>
                                                    </div>
                                                  )
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
                                                              <CheckCircle className="h-4 w-4 animate-spin mr-2" />
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