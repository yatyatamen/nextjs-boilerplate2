import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    let supabaseClient: Awaited<ReturnType<typeof createClient>> | Awaited<ReturnType<typeof createServiceClient>> | null = null

    try {
      supabaseClient = await createServiceClient()
    } catch (serviceError) {
      console.warn("Supabase service role client unavailable, falling back to authenticated client:", serviceError)
      try {
        supabaseClient = await createClient()
      } catch (clientError) {
        console.error("Unable to initialize Supabase client for upload:", clientError)
        return NextResponse.json({ error: "Supabase upload client could not be initialized" }, { status: 500 })
      }
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const filename = `${Date.now()}_${file.name}`
    const bucket = "attachments"

    const arrayBuffer = await file.arrayBuffer()
    const { error } = await supabaseClient.storage.from(bucket).upload(filename, new Uint8Array(arrayBuffer), {
      contentType: file.type || undefined,
    })

    if (error) {
      console.error("Supabase storage upload error:", error)
      return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 })
    }

    const publicUrl = supabaseClient.storage.from(bucket).getPublicUrl(filename).data?.publicUrl

    return NextResponse.json({ data: { publicUrl } })
  } catch (err) {
    console.error("/api/support/upload error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
