import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import type { Booking, Profile } from "@/lib/types"

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

  const [schedule, bookings, announcements, shopItems, assessments, attendance, gearGuides, allProfiles, supportTickets, leaderBookings, manualRoster] = await Promise.all([
    supabase.from("schedule").select("*").order("date", { ascending: true }),
    supabase.from("bookings").select("*").eq("user_id", user.id),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("shop_items").select("*").order("name", { ascending: true }),
    supabase.from("assessments").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    rosterClient.from("attendance").select("*"),
    supabase.from("equipment_recommendations").select("*"),
    supabase.rpc("get_leader_roster"),
    supabase.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    rosterClient.from("bookings").select("*"),
    supabase.from("attendance_manual_roster").select("session_id, user_id, created_at").eq("user_id", user.id),
  ])

  const rosterErrors = [
    allProfiles.error && `profile roster: ${allProfiles.error.message}${allProfiles.error.code ? ` (code ${allProfiles.error.code})` : ""}`,
    leaderBookings.error && `bookings: ${leaderBookings.error.message}${leaderBookings.error.code ? ` (code ${leaderBookings.error.code})` : ""}`,
    attendance.error && `attendance: ${attendance.error.message}${attendance.error.code ? ` (code ${attendance.error.code})` : ""}`,
    manualRoster.error && `manual attendance roster: ${manualRoster.error.message}${manualRoster.error.code ? ` (code ${manualRoster.error.code})` : ""}`,
  ].filter((error): error is string => Boolean(error))
  if (rosterErrors.length > 0) {
    console.error("Leader roster fetch failed:", rosterErrors.join("; "))
  }

  const manualRosterBookings: Booking[] = (manualRoster.data ?? []).map((entry) => ({
    id: `manual-roster:${entry.session_id}:${entry.user_id}`,
    user_id: entry.user_id,
    session_id: entry.session_id,
    status: "confirmed",
    created_at: entry.created_at,
    is_manual_roster: true,
  }))

  return (
    <MemberDashboard
      profile={profile}
      schedule={schedule.data ?? []}
      initialBookings={[...(bookings.data ?? []), ...manualRosterBookings]}
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