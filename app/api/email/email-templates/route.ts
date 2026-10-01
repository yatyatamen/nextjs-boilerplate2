import { NextResponse } from "next/server"
import { mergeEmailTemplateConfig } from "@/lib/email-templates"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  }

  return { supabase, user }
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUser()
    if ("response" in auth) return auth.response

    const { data, error } = await auth.supabase
      .from("email_template_settings")
      .select("templates")
      .eq("id", true)
      .maybeSingle()

    if (error) {
      console.error("Email template load failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: mergeEmailTemplateConfig(data?.templates) })
  } catch (error) {
    console.error("GET /api/email-templates failed:", error)
    return NextResponse.json({ error: "Unable to load email templates" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await getAuthenticatedUser()
    if ("response" in auth) return auth.response

    const { data: profile, error: profileError } = await auth.supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle()

    if (profileError || !["staff", "admin"].includes(profile?.role ?? "")) {
      return NextResponse.json({ error: "Only staff can save email templates" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const templates = mergeEmailTemplateConfig(body?.templates)
    const { error } = await auth.supabase
      .from("email_template_settings")
      .upsert({ id: true, templates, updated_at: new Date().toISOString() }, { onConflict: "id" })

    if (error) {
      console.error("Email template save failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: templates })
  } catch (error) {
    console.error("PUT /api/email-templates failed:", error)
    return NextResponse.json({ error: "Unable to save email templates" }, { status: 500 })
  }
}