import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_BUTTON_THEME_HUE = 176

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("button_theme_hue")
      .eq("user_id", authData.user.id)
      .maybeSingle()

    if (error) {
      console.error("Dashboard preferences fetch failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      buttonThemeHue: data?.button_theme_hue ?? DEFAULT_BUTTON_THEME_HUE,
    })
  } catch (error) {
    console.error("Dashboard preferences GET error:", error)
    return NextResponse.json({ error: "Unable to load dashboard preferences" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const hue = typeof body === "object" && body !== null && "buttonThemeHue" in body
      ? body.buttonThemeHue
      : null

    if (typeof hue !== "number" || !Number.isInteger(hue) || hue < 0 || hue > 359) {
      return NextResponse.json({ error: "buttonThemeHue must be a whole number from 0 to 359" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: authData.user.id,
          button_theme_hue: hue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("button_theme_hue")
      .single()

    if (error) {
      console.error("Dashboard preferences save failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ buttonThemeHue: data.button_theme_hue })
  } catch (error) {
    console.error("Dashboard preferences PATCH error:", error)
    return NextResponse.json({ error: "Unable to save dashboard preferences" }, { status: 500 })
  }
}
