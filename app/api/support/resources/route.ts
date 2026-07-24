import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createResource, deleteResource, listResources } from "@/lib/support-store"

function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ data: listResources() })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase fetch error:", error)
      return NextResponse.json({ data: listResources() })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error("GET /api/support/resources error:", err)
    return NextResponse.json({ data: listResources() })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, url } = body

    if (!title || !url) {
      return NextResponse.json(
        { error: "Title and URL are required" },
        { status: 400 }
      )
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ data: createResource({ title, url }) })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("resources")
      .insert({ title, url })
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json({ data: createResource({ title, url }) })
    }

    return NextResponse.json({ data: data?.[0] })
  } catch (err) {
    console.error("POST /api/support/resources error:", err)
    return NextResponse.json({ data: createResource({ title: "Resource", url: "" }) })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      )
    }

    if (!isSupabaseConfigured()) {
      deleteResource(id)
      return NextResponse.json({ success: true })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", id)

    if (error) {
      deleteResource(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/support/resources error:", err)
    return NextResponse.json({ success: true })
  }
}
