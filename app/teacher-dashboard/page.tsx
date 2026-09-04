import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard"
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
    leadersRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name", { ascending: true }),
    supabase.from("schedule").select("*").order("date", { ascending: true }),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("bookings").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
    supabase.from("attendance").select("*").order("marked_at", { ascending: false }),
    supabase.from("leader_profiles").select("*").order("created_at", { ascending: false }),
  ])

  return (
    <TeacherDashboard
      profile={profile}
      initialMembers={membersRes.data ?? []}
      initialSchedule={scheduleRes.data ?? []}
      initialAnnouncements={announcementsRes.data ?? []}
      initialBookings={bookingsRes.data ?? []}
      initialAttendanceRecords={attendanceRes.data ?? []}
      initialLeaders={leadersRes.data ?? []}
    />
  )
}
