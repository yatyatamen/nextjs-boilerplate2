import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { StaffDashboard } from "@/components/dashboard/staff-dashboard"
import type { Profile } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function LeaderDashboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/")
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>()
  if (!profile || profile.role !== "leader") redirect("/member-dashboard")

  const rosterClient = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    ? await createServiceClient()
    : supabase

  const [members, schedule, bookings, attendance] = await Promise.all([
    rosterClient.from("profiles").select("*"),
    supabase.from("schedule").select("*").order("date", { ascending: true }),
    rosterClient.from("bookings").select("*"),
    rosterClient.from("attendance").select("*"),
  ])

  return (
    <StaffDashboard
      profile={profile}
      initialMembers={members.data ?? []}
      initialSchedule={schedule.data ?? []}
      initialBookings={bookings.data ?? []}
      initialAttendanceRecords={attendance.data ?? []}
      initialAnnouncements={[]}
      initialAssessments={[]}
      initialBlogPosts={[]}
    />
  )
}