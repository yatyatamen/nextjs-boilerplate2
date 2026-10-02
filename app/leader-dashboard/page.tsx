import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
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

  const [schedule, bookings, announcements, shopItems, assessments, attendance, gearGuides, allProfiles, supportTickets, leaderBookings] = await Promise.all([
    supabase.from("schedule").select("*").order("date", { ascending: true }),
    supabase.from("bookings").select("*").eq("user_id", user.id),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("shop_items").select("*").order("name", { ascending: true }),
    supabase.from("assessments").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    rosterClient.from("attendance").select("*"),
    supabase.from("equipment_recommendations").select("*"),
    rosterClient.from("profiles").select("id, first_name, last_name, full_name, email, role, level"),
    supabase.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    rosterClient.from("bookings").select("*"),
  ])

  if (allProfiles.error) {
    console.error("Leader profile roster fetch failed:", allProfiles.error.message)
  }

  return (
    <MemberDashboard
      profile={profile}
      schedule={schedule.data ?? []}
      initialBookings={bookings.data ?? []}
      announcements={announcements.data ?? []}
      shopItems={(shopItems.data ?? []).filter((item: any) => !(item.is_hidden === true || item.hidden === true || item.visible === false))}
      assessments={assessments.data ?? []}
      attendanceRecords={attendance.data ?? []}
      gearGuides={(gearGuides.data ?? []).filter((item: any) => !(item.is_hidden === true || item.hidden === true || item.visible === false))}
      allProfiles={allProfiles.data ?? []}
      leaderBookings={leaderBookings.data ?? []}
      supportTickets={supportTickets.data ?? []}
    />
  )
}