import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServerClient } from "../../../lib/supabase/server"

function buildFallbackTicket(subject: string, message: string, userId: string | null, userEmail: string | null) {
  return {
    id: `fallback-${Date.now()}`,
    user_id: userId ?? "anonymous",
    user_email: userEmail ?? "",
    subject,
    message,
    status: "open",
    created_at: new Date().toISOString(),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const subject = typeof body?.subject === "string" ? body.subject.trim() : ""
    const message = typeof body?.message === "string" ? body.message.trim() : ""

    if (!subject || !message) {
      return NextResponse.json(
        { error: "Subject and message are required" },
        { status: 400 },
      )
    }

    let userId: string | null = null
    let userEmail: string | null = null

    try {
      const supabase = await createSupabaseServerClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (!userError && userData?.user) {
        userId = userData.user.id
        userEmail = userData.user.email ?? null
      }
    } catch (authError) {
      console.warn("Support auth lookup failed, continuing with fallback:", authError)
    }

    try {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          user_email: userEmail,
          subject,
          message,
          status: "open",
          created_at: new Date().toISOString(),
        })
        .select()

      if (!error && data) {
        return NextResponse.json({ data })
      }

      console.warn("Support ticket insert failed, using fallback response:", error)
    } catch (dbError) {
      console.warn("Support ticket insert threw, using fallback response:", dbError)
    }

    return NextResponse.json({
      data: [buildFallbackTicket(subject, message, userId, userEmail)],
      fallback: true,
    })
  } catch (err) {
    console.error("Support route POST error:", err)
    return NextResponse.json(
      {
        data: [buildFallbackTicket("Purchase Request", "Fallback submission", null, null)],
        fallback: true,
      },
      { status: 200 },
    )
  }
}

export async function GET() {
  try {
    let userId: string | null = null
    try {
      const supabase = await createSupabaseServerClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (!userError && userData?.user) {
        userId = userData.user.id
      }
    } catch (authError) {
      console.warn("Support auth lookup failed during GET:", authError)
    }

    if (!userId) {
      return NextResponse.json({ data: [], fallback: true })
    }

    try {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (!error) {
        return NextResponse.json({ data })
      }

      console.warn("Support ticket fetch failed, returning empty fallback:", error)
    } catch (dbError) {
      console.warn("Support ticket fetch threw, returning empty fallback:", dbError)
    }

    return NextResponse.json({ data: [], fallback: true })
  } catch (err) {
    console.error("Support route GET error:", err)
    return NextResponse.json({ data: [], fallback: true })
  }
}