export const ALLOWED_DOMAIN = "@gapps.yrdsb.ca"

// Roles and levels share one set of selectable profile values.
export const ROLE_AND_LEVEL_OPTIONS = [
  "staff",
  "teacher",
  "Bronze",
  "Silver",
  "Gold",
  "Diamond",
  "Diamond2",
] as const

// Stored profiles may still contain legacy roles that are not selectable.
export const ROLES = ["staff", "teacher", "admin", "coach", "for fun", "member"] as const
export const ROLE_OPTIONS = ["staff", "teacher"] as const
export const LEVELS = ["Bronze", "Silver", "Gold", "Diamond", "Diamond2"] as const

export const getRoleOptions = () => [...ROLE_OPTIONS]
export type Role = (typeof ROLES)[number]
export const TIER_OPTIONS = [...LEVELS]
export const getTierOptions = () => [...TIER_OPTIONS]
export type Level = (typeof LEVELS)[number]

export const ALL_ROLE_AND_TIER_OPTIONS = [...ROLE_AND_LEVEL_OPTIONS] as const
export const getAllRoleAndTierOptions = () => [...ALL_ROLE_AND_TIER_OPTIONS]

export function isValidSchoolEmail(email: string): boolean {
  return /^[^\s@]+@gapps\.yrdsb\.ca$/i.test(email.trim())
}

export type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  role: Role
  level: string | null
  avatar_url?: string | null
  created_at: string
}

export type ScheduleSession = {
  id: string
  title: string | null         // Added: Custom Session Title (e.g. "Free Play Section")
  date: string | null
  time: string | null          // Supports formats like "3:20-4:30"
  min_level: string | null     // Added: Multi-tier lower limit restriction
  max_level: string | null     // Added: Multi-tier upper limit restriction
  coach: string | null
  notes: string | null
}

export type Booking = {
  id: string
  user_id: string | null
  session_id: string | null
  status: string | null
  notes?: string | null
  created_at?: string | null
}

export type Announcement = {
  id: string
  title: string | null
  content: string | null
  created_at: string
}

export type ShopItem = {
  id: string
  name: string | null
  category: string | null
  price: number | null
  description: string | null
  stock: number | null
  image_url?: string | null
  pic_url?: string | null
  image_urls?: string[] | null
  unit?: string | null
}

export type Assessment = {
  id: string
  user_id: string | null
  level: string | null 
  feedback: string | null
  score?: number | null 
  date: string | null
  pdf_url?: string | null
}

export type AttendanceRecord = {
  id: string
  session_id: string
  user_id: string
  user_name: string
  user_level: string
  marked_at: string
  status: "present" | "absent" | "late"
  notes?: string | null
}

export type EquipmentRecommendation = {
  id: string
  title: string
  brand: string
  category: string | null
  specs: string 
  why_recommend: string
  recommended_for_tier: string 
  external_link: string | null
  image_url: string | null 
  image_urls?: string[] | null
}

export type SupportTicket = {
  id: string
  user_id: string
  user_email: string
  subject: string
  message: string
  status: "unread" | "unsolved" | "solved" | "open" | "resolved"
  created_at: string
}

export type BlogPost = {
  id: string
  title: string
  content: string
  created_at: string
  image_url?: string | null
}

export type Resource = {
  id: string
  title: string | null
  url: string | null
  created_at: string
}