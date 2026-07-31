import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const email = url.searchParams.get("email")?.trim()

  if (!email) {
    return NextResponse.json(
      { exists: false, error: "Missing email query parameter" },
      { status: 400 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { exists: false, error: "Supabase service role key is not configured" },
      { status: 500 },
    )
  }

  const adminUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(
    email,
  )}`

  const res = await fetch(adminUrl, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  })

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json(
      {
        exists: false,
        error: `Supabase admin request failed: ${res.status}`,
        body,
      },
      { status: res.status },
    )
  }

  const data = await res.json()
  const users = Array.isArray(data)
    ? data
    : Array.isArray(data?.users)
    ? data.users
    : []

  return NextResponse.json({ exists: users.length > 0, count: users.length, data })
}
