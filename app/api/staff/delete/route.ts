import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const TABLES = {
  gear_guide: "equipment_recommendations",
  shop_item: "shop_items",
  announcement: "announcements",
} as const

type DeletableType = keyof typeof TABLES

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === "string" ? body.id : ""
    const type = body?.type as DeletableType
    const table = TABLES[type]

    if (!id || !table) {
      return NextResponse.json({ error: "A valid item type and id are required" }, { status: 400 })
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

    if (profileError || profile?.role !== "staff") {
      return NextResponse.json({ error: "Only staff can delete published items" }, { status: 403 })
    }

    let database = userClient
    try {
      database = await createServiceClient()
    } catch {
      // Use the authenticated client when the service role is unavailable.
    }

    const { error } = await database.from(table).delete().eq("id", id)
    if (error) {
      console.error(`Staff delete failed for ${table}:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { deleted: true, id, type } })
  } catch (error) {
    console.error("Staff delete route error:", error)
    return NextResponse.json({ error: "Unable to delete item" }, { status: 500 })
  }
}
