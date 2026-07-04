export const ALLOWED_DOMAIN = "@gapps.yrdsb.ca"

export const LEVELS = ["Beginner", "Intermediate", "Advanced", "Competitive"] as const
export type Level = (typeof LEVELS)[number]

export type Role = "member" | "staff"

export function isValidSchoolEmail(email: string): boolean {
  return /^[^\s@]+@gapps\.yrdsb\.ca$/i.test(email.trim())
}

export type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: Role
  level: string | null
  created_at: string
}

export type ScheduleSession = {
  id: string
  date: string | null
  time: string | null
  level: string | null
  coach: string | null
  notes: string | null
}

export type Booking = {
  id: string
  user_id: string | null
  session_id: string | null
  status: string | null
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
}

export type BlogPost = {
  id: string
  title: string | null
  content: string | null
  created_at: string
}

export type Assessment = {
  id: string
  user_id: string | null
  level: string | null
  feedback: string | null
  date: string | null
}
