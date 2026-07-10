import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { StaffDashboard } from "@/components/dashboard/staff-dashboard"
import type { Profile } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function StaffDashboardPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect("/")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/")

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>()

  if (!profile) redirect("/")
  if (profile.role !== "staff") redirect("/member-dashboard")

  // 2. Safe data fetching (prevents crashing if tables/columns are broken)
  const [
    membersRes, 
    scheduleRes, 
    announcementsRes, 
    blogPostsRes, 
    shopItemsRes, 
    assessmentsRes
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("schedule").select("*").order("date", { ascending: true }),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("blog_posts").select("*").order("created_at", { ascending: false }),
    supabase.from("shop_items").select("*").order("name", { ascending: true }),
    supabase.from("assessments").select("*").order("date", { ascending: false }),
  ])

  // Log table errors to your server terminal so you can spot what's broken
  if (scheduleRes.error) console.error("❌ Schedule Fetch Error:", scheduleRes.error.message)
  if (membersRes.error) console.error("❌ Members Fetch Error:", membersRes.error.message)
  if (announcementsRes.error) console.error("❌ Announcements Fetch Error:", announcementsRes.error.message)

  return (
    <StaffDashboard
      profile={profile}
      initialMembers={membersRes.data ?? []}
      initialSchedule={scheduleRes.data ?? []}
      initialAnnouncements={announcementsRes.data ?? []}
      initialBlogPosts={blogPostsRes.data ?? []}
      initialShopItems={shopItemsRes.data ?? []}
      initialAssessments={assessmentsRes.data ?? []}
    />
  )
}