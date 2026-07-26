import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const serviceClient = await createServiceClient()
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const filename = `${Date.now()}_${file.name}`
    const bucket = "attachments"

    const arrayBuffer = await file.arrayBuffer()
    const { error } = await serviceClient.storage.from(bucket).upload(filename, new Uint8Array(arrayBuffer), {
      contentType: file.type || undefined,
    })

    if (error) {
      console.error("Supabase storage upload error:", error)
      return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 })
    }

    const publicUrl = serviceClient.storage.from(bucket).getPublicUrl(filename).data?.publicUrl

    return NextResponse.json({ data: { publicUrl } })
  } catch (err) {
    console.error("/api/support/upload error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
