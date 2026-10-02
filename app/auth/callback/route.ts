import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

  if (!userError && user && fullName) {
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()

    if (profileLookupError) {
      console.error("Confirmed user profile lookup failed:", profileLookupError.message)
    } else if (existingProfile) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ email: user.email ?? null, full_name: fullName })
        .eq("id", user.id)
      if (profileUpdateError) console.error("Confirmed user profile name sync failed:", profileUpdateError.message)
    } else {
      const { error: profileInsertError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email ?? null,
        full_name: fullName,
        role: "member",
        level: "member",
        marketing_emails: true,
      })
      if (profileInsertError) console.error("Confirmed user profile creation failed:", profileInsertError.message)
    }
  }

  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/"
  return NextResponse.redirect(new URL(safeNext, requestUrl.origin))
}
