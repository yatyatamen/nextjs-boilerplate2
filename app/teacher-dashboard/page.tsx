import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TeacherDashboard } from "../../components/dashboard/teacher-dashboard"
import type { Profile } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function TeacherDashboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/")
  }

  const supabase = await createClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect("/")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single<Profile>()

  if (!profile) redirect("/")
  if (profile.role !== "teacher") {
    redirect(profile.role === "staff" ? "/staff-dashboard" : "/member-dashboard")
  }

  const [
    membersRes,
    scheduleRes,
    announcementsRes,
    bookingsRes,
    attendanceRes,
    shopItemsRes,
    assessmentsRes,
    gearGuidesRes,
    supportTicketsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name", { ascending: true }),
    supabase.from("schedule").select("*").order("date", { ascending: true }),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("bookings").select("*").order("created_at", { ascending: false }),
    supabase.from("attendance").select("*").order("marked_at", { ascending: false }),
    supabase.from("shop_items").select("*").order("name", { ascending: true }),
    supabase.from("assessments").select("*").order("date", { ascending: false }),
    supabase.from("equipment_recommendations").select("*").order("title", { ascending: true }),
    supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
  ])

  return (
    <TeacherDashboard
      profile={profile}
      initialMembers={membersRes.data ?? []}
      initialSchedule={scheduleRes.data ?? []}
      initialAnnouncements={announcementsRes.data ?? []}
      initialBookings={bookingsRes.data ?? []}
      initialAttendanceRecords={attendanceRes.data ?? []}
      initialShopItems={(shopItemsRes.data ?? []).filter((item: any) => !(item.is_hidden === true || item.hidden === true || item.visible === false))}
      initialAssessments={assessmentsRes.data ?? []}
      initialGearGuides={(gearGuidesRes.data ?? []).filter((item: any) => !(item.is_hidden === true || item.hidden === true || item.visible === false))}
      initialSupportTickets={supportTicketsRes.data ?? []}
    />
  )
}
