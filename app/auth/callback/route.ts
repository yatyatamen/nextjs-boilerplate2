import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next")

  if (!code) {
    return NextResponse.redirect(new URL("/?error=confirmation_failed", requestUrl.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("Auth callback error:", error.message)
    return NextResponse.redirect(new URL("/?error=confirmation_failed", requestUrl.origin))
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  const fullName = typeof user?.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name.trim()
    : ""

  let profileSyncFailed = false
  if (!userError && user) {
    let database = supabase
    try {
      database = await createServiceClient()
    } catch {
      // Use the authenticated client when service-role configuration is unavailable.
    }

    const { data: existingProfile, error: profileLookupError } = await database
      .from("profiles")
      .select("id, level")
      .eq("id", user.id)
      .maybeSingle()

    if (profileLookupError) {
      console.error("Confirmed user profile lookup failed:", profileLookupError.message)
      profileSyncFailed = true
    } else if (existingProfile) {
      const updates = {
        email: user.email ?? null,
        ...(fullName ? { full_name: fullName } : {}),
        ...(!existingProfile.level?.trim() ? { level: "member" } : {}),
      }
      const { data: updatedProfile, error: profileUpdateError } = await database
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select("id")
        .maybeSingle()
      if (profileUpdateError) {
        console.error("Confirmed user profile default sync failed:", profileUpdateError.message)
        profileSyncFailed = true
      } else if (!updatedProfile) {
        console.error("Confirmed user profile sync did not update a profile.")
        profileSyncFailed = true
      }
    } else {
      const { data: createdProfile, error: profileInsertError } = await database
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email ?? null,
          full_name: fullName || null,
          role: "member",
          level: "member",
          marketing_emails: true,
        })
        .select("role, level")
        .single()
      if (profileInsertError) {
        console.error("Confirmed user profile creation failed:", profileInsertError.message)
        profileSyncFailed = true
      } else if (createdProfile.role !== "member" || createdProfile.level !== "member") {
        console.error("New confirmed user profile defaults were not saved as member.", createdProfile)
        profileSyncFailed = true
      }
    }
  }

  if (profileSyncFailed) {
    return NextResponse.redirect(new URL("/?error=profile_sync_failed", requestUrl.origin))
  }

  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/member-dashboard"
  return NextResponse.redirect(new URL(safeNext, requestUrl.origin))
}
