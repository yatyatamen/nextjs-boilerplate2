export const ALLOWED_DOMAIN = "@gapps.yrdsb.ca"

// Updated to the exact 6 tiers requested: For Fun up to Diamond II
export const LEVELS = [
  "For Fun",
  "Bronze",
  "Silver",
  "Gold",
  "Diamond",
  "Diamond II"
] as const
export type Level = (typeof LEVELS)[number]

export type Role = "member" | "staff"

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
  unit?: string | null
}

export type Assessment = {
  id: string
  user_id: string | null
  level: string | null 
  feedback: string | null
  score?: number | null 
  date: string | null
}

export type StaffProfile = {
  id: string
  name: string
  role_title: string 
  bio: string | null
  specialties: string[] 
  avatar_url: string | null 
}

export type AttendanceRecord = {
  id: string
  session_id: string
  user_id: string
  user_name: string
  user_level: string
  marked_at: string
  status: "present" | "absent" | "late"
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
}

export type SupportTicket = {
  id: string
  user_id: string
  user_email: string
  subject: string
  message: string
  status: "open" | "resolved"
  created_at: string
}

export type BlogPost = {
  id: string
  title: string
  content: string
  created_at: string
  image_url?: string | null
}