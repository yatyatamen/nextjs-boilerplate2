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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>()

  if (!profile) redirect("/")
  if (profile.role !== "staff") redirect("/member-dashboard")

  const [members, schedule, announcements, blogPosts, shopItems, assessments] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("schedule").select("*").order("date", { ascending: true }),
      supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("shop_items").select("*").order("name", { ascending: true }),
      supabase
        .from("assessments")
        .select("*")
        .order("date", { ascending: false }),
    ])

  return (
    <StaffDashboard
      profile={profile}
      initialMembers={members.data ?? []}
      initialSchedule={schedule.data ?? []}
      initialAnnouncements={announcements.data ?? []}
      initialBlogPosts={blogPosts.data ?? []}
      initialShopItems={shopItems.data ?? []}
      initialAssessments={assessments.data ?? []}
    />
  )
}
