import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const memberId = typeof body?.memberId === "string" ? body.memberId : undefined
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : undefined
    const level = typeof body?.level === "string" ? body.level.trim() : undefined

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 })
    }

    if (!fullName && !level) {
      return NextResponse.json({ error: "At least one of fullName or level is required" }, { status: 400 })
    }

    try {
      const supabase = await createSupabaseServerClient()

      // Build the update object dynamically
      const updateData: Record<string, string> = {}
      if (fullName) updateData.full_name = fullName
      if (level) updateData.level = level

      // Update the profile
      const { data, error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", memberId)
        .select()

      if (error) {
        console.error("Profile update error:", error)
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
      }

      if (!data || data.length === 0) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 })
      }

      return NextResponse.json({ data: data[0] })
    } catch (dbErr) {
      console.error("Profile update database error:", dbErr)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }
  } catch (err) {
    console.error("Profile PATCH error:", err)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}
