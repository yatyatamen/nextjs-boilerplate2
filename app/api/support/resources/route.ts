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
      return NextResponse.json({ error: error.message }, { status: 500 })
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
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle()
    if (profileError || !profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Only staff can save resources" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("resources")
      .insert({ title, url })
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data?.[0]) {
      return NextResponse.json({ error: "Resource save returned no record" }, { status: 500 })
    }

    return NextResponse.json({ data: data[0] })
  } catch (err) {
    console.error("POST /api/support/resources error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to save resource" }, { status: 500 })
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
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle()
    if (profileError || !profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Only staff can delete resources" }, { status: 403 })
    }

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Supabase delete error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/support/resources error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to delete resource" }, { status: 500 })
  }
}
