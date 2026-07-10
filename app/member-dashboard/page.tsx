import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import type { Profile } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function MemberDashboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>()

  // Fixed mapping block to fully satisfy the internal Profile type definition
  const activeProfile: Profile = {
    id: user.id,
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    full_name: profile?.full_name || user.user_metadata?.full_name || "New Wolf Member",
    email: profile?.email || user.email || "",
    role: profile?.role || "member",
    level: profile?.level || "For Fun",
    created_at: profile?.created_at || new Date().toISOString()
  }

  // ... your existing code ...
  const [
    schedule, 
    bookings, 
    announcements, 
    shopItems, 
    assessments,
    coachesResult, // Renamed to process manually below
    attendance,
    gearGuides,
    allProfiles,
    supportTickets
  ] = await Promise.all([
    supabase.from("schedule").select("*").order("date", { ascending: true }),
    supabase.from("bookings").select("*").eq("user_id", user.id),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("shop_items").select("*").order("name", { ascending: true }),
    supabase.from("assessments").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("leader_profiles").select("*").order("created_at", { ascending: false }), 
    supabase.from("attendance").select("*"), 
    supabase.from("equipment_recommendations").select("*"),
    supabase.from("profiles").select("*").order("full_name", { ascending: true }),
    supabase.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
  ])

  // Safely bridge the database columns to whatever keys your UI component expects!
  const formattedCoaches = (coachesResult.data ?? []).map((c: any) => ({
    ...c,
    // Add variations just in case your dashboard looks for different names
    full_name: c.name, 
    bio: c.description,
    avatar_url: c.pic_url,
  }))

  return (
    <MemberDashboard
      profile={activeProfile}
      schedule={schedule.data ?? []}
      initialBookings={bookings.data ?? []}
      announcements={announcements.data ?? []}
      shopItems={shopItems.data ?? []}
      assessments={assessments.data ?? []}
      coaches={formattedCoaches} // Passes down the mapped fields securely
      attendanceRecords={attendance.data ?? []}
      gearGuides={gearGuides.data ?? []}
      allProfiles={allProfiles.data ?? []}
      supportTickets={supportTickets.data ?? []}
    />
  )
}