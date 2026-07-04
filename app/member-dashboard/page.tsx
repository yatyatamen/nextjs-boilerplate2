import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import type { Profile } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function MemberDashboardPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect("/login")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>()

  if (!profile) {
    redirect("/login?error=Profile+not+found.+Please+register+again.")
  }

  if (profile.role === "staff") redirect("/staff-dashboard")

  const [schedule, bookings, announcements, shopItems, blogPosts, assessments] =
    await Promise.all([
      supabase.from("schedule").select("*").order("date", { ascending: true }),
      supabase.from("bookings").select("*").eq("user_id", user.id),
      supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("shop_items").select("*").order("name", { ascending: true }),
      supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("assessments")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false }),
    ])

  return (
    <MemberDashboard
      profile={profile}
      schedule={schedule.data ?? []}
      initialBookings={bookings.data ?? []}
      announcements={announcements.data ?? []}
      shopItems={shopItems.data ?? []}
      blogPosts={blogPosts.data ?? []}
      assessments={assessments.data ?? []}
    />
  )
}