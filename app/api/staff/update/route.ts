import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const TABLES = {
  schedule: "schedule",
  shop_item: "shop_items",
  gear_guide: "equipment_recommendations",
} as const

type UpdateType = keyof typeof TABLES

const ALLOWED_FIELDS: Record<UpdateType, string[]> = {
  schedule: ["title", "date", "time", "max_capacity", "max_level", "coach", "notes", "visibility_tiers"],
  shop_item: ["name", "category", "price", "description", "specs", "pic_url", "image_urls", "stock", "unit"],
  gear_guide: ["title", "category", "description", "specs", "recommended_for_tier", "link", "image_url", "pic_url", "image_urls"],
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === "string" ? body.id : ""
    const type = body?.type as UpdateType
    const table = TABLES[type]
    const payload = body?.payload

    if (!id || !table || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "A valid item type, id, and payload are required" }, { status: 400 })
    }

    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || !["staff", "admin"].includes(profile?.role)) {
      return NextResponse.json({ error: "Only staff can update published items" }, { status: 403 })
    }

    const allowedFields = new Set(ALLOWED_FIELDS[type])
    const updates = Object.fromEntries(
      Object.entries(payload).filter(([key]) => allowedFields.has(key)),
    )

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No editable fields were provided" }, { status: 400 })
    }

    const database = await createServiceClient()
    const { data, error } = await database
      .from(table)
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error(`Staff update failed for ${table}:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Staff update route error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update item" }, { status: 500 })
  }
}
