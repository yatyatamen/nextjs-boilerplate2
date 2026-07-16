import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "../../../lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const itemId = body?.itemId
    const itemName = body?.itemName
    const category = body?.category
    const userId = body?.userId
    const userName = body?.userName
    const note = body?.note ?? null

    if (!itemName || !userId) {
      return NextResponse.json({ error: "itemName and userId are required" }, { status: 400 })
    }

    const payload = {
      item_id: itemId ?? null,
      item_name: itemName,
      category: category ?? null,
      user_id: userId,
      user_name: userName ?? null,
      note,
      status: "requested",
      created_at: new Date().toISOString(),
    }

    try {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase.from("orders").insert(payload).select()
      if (!error && data) {
        return NextResponse.json({ data: data[0] })
      }
      console.warn("Order insert failed:", error)
    } catch (dbErr) {
      console.warn("Order insert threw:", dbErr)
    }

    return NextResponse.json({ data: { ...payload, fallback: true } })
  } catch (err) {
    console.error("Orders POST error:", err)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    try {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false })
      if (!error && data) return NextResponse.json({ data })
      console.warn("Orders fetch failed:", error)
    } catch (dbErr) {
      console.warn("Orders fetch threw:", dbErr)
    }

    return NextResponse.json({ data: [] })
  } catch (err) {
    console.error("Orders GET error:", err)
    return NextResponse.json({ data: [] })
  }
}
