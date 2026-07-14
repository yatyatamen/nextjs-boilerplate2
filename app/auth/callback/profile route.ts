import { promises as fs } from "node:fs"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"

async function resolveSupabaseAdminCredentials() {
  const directUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const directServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

  if (directUrl && directServiceRoleKey) {
    return { supabaseUrl: directUrl, serviceRoleKey: directServiceRoleKey }
  }

  const envCandidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "app/.env.local"),
    path.resolve(process.cwd(), "../.env.local"),
    path.resolve(process.cwd(), "../app/.env.local"),
  ]

  for (const envPath of envCandidates) {
    try {
      const content = await fs.readFile(envPath, "utf8")
      const parsed = Object.fromEntries(
        content
          .split(/\r?\n/)
          .flatMap((line) => {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith("#")) return []
            const separatorIndex = trimmed.indexOf("=")
            if (separatorIndex === -1) return []
            const key = trimmed.slice(0, separatorIndex).trim()
            const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "")
            return [[key, value]]
          }),
      )

      const url = parsed.NEXT_PUBLIC_SUPABASE_URL || parsed.SUPABASE_URL
      const serviceRoleKey = parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

      if (url && serviceRoleKey) {
        return { supabaseUrl: url, serviceRoleKey }
      }
    } catch {
      // Ignore missing env files and continue checking other candidates.
    }
  }

  return { supabaseUrl: undefined, serviceRoleKey: undefined }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const memberId = typeof body?.memberId === "string" ? body.memberId : ""
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : undefined
    const level = typeof body?.level === "string" ? body.level : undefined

    if (!memberId || (!fullName && !level)) {
      return NextResponse.json({ error: "Member ID and either fullName or level are required." }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "You must be signed in to update member names." }, { status: 401 })
    }

    const { data: actorProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || !actorProfile || actorProfile.role !== "staff") {
      return NextResponse.json({ error: "Only staff can update member display names." }, { status: 403 })
    }

    const updates: Record<string, any> = {}
    if (fullName) updates.full_name = fullName
    if (level) updates.level = level

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", memberId)
      .select("id, full_name, level")
      .single()

    if (error) {
      const { supabaseUrl, serviceRoleKey } = await resolveSupabaseAdminCredentials()

      if (supabaseUrl && serviceRoleKey) {
        const adminClient = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })

        const adminUpdates: Record<string, any> = {}
        if (fullName) adminUpdates.full_name = fullName
        if (level) adminUpdates.level = level

        const { data: adminData, error: adminError } = await adminClient
          .from("profiles")
          .update(adminUpdates)
          .eq("id", memberId)
          .select("id, full_name, level")
          .single()

        if (adminError) {
          console.error("Profile update failed with staff client and admin fallback:", adminError)
          return NextResponse.json({ error: adminError.message }, { status: 500 })
        }

        return NextResponse.json({ data: adminData })
      }

      console.error("Profile update failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Profile update route error:", error)
    return NextResponse.json({ error: "Unable to update member display name." }, { status: 500 })
  }
}
