import { NextResponse } from "next/server"
import {
  DEFAULT_EMAIL_DELIVERY_CONFIG,
  mergeEmailDeliveryConfig,
  type EmailDeliveryConfig,
} from "@/lib/email-templates"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

async function getStaffClient() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError || profile?.role !== "staff") {
    return { response: NextResponse.json({ error: "Only staff can manage automatic email settings" }, { status: 403 }) }
  }

  return { supabase, user }
}

function getSettingsError(error: { code?: string; message: string }) {
  if (error.code === "PGRST205") {
    return {
      message: "Automatic email controls are not configured. Apply supabase/migration/20261125120000_scheduled_events_and_email_controls.sql.",
      status: 503,
    }
  }
  return { message: error.message, status: 500 }
}

export async function GET() {
  try {
    const auth = await getStaffClient()
    if ("response" in auth) return auth.response

    const { data, error } = await auth.supabase
      .from("auto_email_settings")
      .select("enabled_emails")
      .eq("id", true)
      .maybeSingle()
    if (error) {
      const failure = getSettingsError(error)
      return NextResponse.json({ error: failure.message }, { status: failure.status })
    }
    return NextResponse.json({ data: mergeEmailDeliveryConfig(data?.enabled_emails) })
  } catch (error) {
    console.error("GET /api/auto-email-settings failed:", error)
    return NextResponse.json({ error: "Unable to load automatic email settings" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await getStaffClient()
    if ("response" in auth) return auth.response

    const body = await request.json().catch(() => ({}))
    const settings = body?.enabled_emails
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return NextResponse.json({ error: "Email settings are invalid" }, { status: 400 })
    }

    const enabledEmails = mergeEmailDeliveryConfig(settings)
    const missingBoolean = (Object.keys(DEFAULT_EMAIL_DELIVERY_CONFIG) as Array<keyof EmailDeliveryConfig>)
      .some((key) => typeof settings[key] !== "boolean")
    if (missingBoolean) {
      return NextResponse.json({ error: "Choose on or off for every automatic email type" }, { status: 400 })
    }

    const { error } = await auth.supabase
      .from("auto_email_settings")
      .upsert({
        id: true,
        enabled_emails: enabledEmails,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      }, { onConflict: "id" })
    if (error) {
      const failure = getSettingsError(error)
      return NextResponse.json({ error: failure.message }, { status: failure.status })
    }

    return NextResponse.json({ data: enabledEmails })
  } catch (error) {
    console.error("PUT /api/auto-email-settings failed:", error)
    return NextResponse.json({ error: "Unable to save automatic email settings" }, { status: 500 })
  }
}
