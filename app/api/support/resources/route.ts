import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase fetch error:", error)
      return NextResponse.json(
        { error: `Failed to fetch resources: ${error.message}`, details: error },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error("GET /api/support/resources error:", err)
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { title, url } = body

    if (!title || !url) {
      return NextResponse.json(
        { error: "Title and URL are required" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("resources")
      .insert({ title, url })
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json(
        { error: `Failed to create resource: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data?.[0] })
  } catch (err) {
    console.error("POST /api/support/resources error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete resource: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/support/resources error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
