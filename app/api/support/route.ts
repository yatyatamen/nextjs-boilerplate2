import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listTicketsForUser, createTicket, listAllTickets, deleteTicket, deleteTicketsBySubject, deleteAllTickets } from "@/lib/support-store"

export async function GET(request: NextRequest) {
	try {
		let supabase = null
		try {
			supabase = await createClient()
		} catch (clientErr) {
			console.warn('Supabase client not available, using local store fallback', clientErr)
		}

		if (!supabase) {
			// Return all local tickets when Supabase isn't configured
			return NextResponse.json({ data: listAllTickets() })
		}

		const { data: userData } = await supabase.auth.getUser()
		const user = userData?.user

		if (!user) {
			// If we don't have a logged-in user, return local tickets if any (fallback)
			return NextResponse.json({ data: [] })
		}

		const url = new URL(request.url)
		const shouldFetchAll = url.searchParams.get("all") === "true"
		const role = (user.user_metadata?.role ?? user.app_metadata?.role ?? "") as string
		const isStaff = shouldFetchAll || role === "staff"
		const query = supabase.from("support_tickets").select("*").order("created_at", { ascending: false })
		const { data, error } = isStaff
			? await query
			: await query.eq("user_id", user.id)

		if (error) {
			console.error("Supabase fetch error (support tickets):", error)
			return NextResponse.json({ data: [] })
		}

		return NextResponse.json({ data: data ?? [] })
	} catch (err) {
		console.error("GET /api/support error:", err)
		return NextResponse.json({ data: [] })
	}
}

export async function DELETE(request: NextRequest) {
	try {
		let supabase = null
		try {
			supabase = await createClient()
		} catch (clientErr) {
			console.warn('Supabase client not available, using local store fallback', clientErr)
		}

		const url = new URL(request.url)
		const search = url.searchParams
		const all = search.get("all")
		const convo = search.get("convo")

		// If query param 'all' present -> delete all tickets
		if (all) {
			if (!supabase) {
				const count = deleteAllTickets()
				return NextResponse.json({ data: { deleted: count } })
			}
			const { error } = await supabase.from("support_tickets").delete().neq("id", null)
			if (error) {
				console.error("Supabase delete all error:", error)
				return NextResponse.json({ error: "Delete failed" }, { status: 500 })
			}
			return NextResponse.json({ data: { deleted: -1 } })
		}

		// Delete by conversation subject
		if (convo) {
			if (!supabase) {
				const count = deleteTicketsBySubject(convo)
				return NextResponse.json({ data: { deleted: count } })
			}
			const { error } = await supabase.from("support_tickets").delete().eq("subject", convo)
			if (error) {
				console.error("Supabase delete convo error:", error)
				return NextResponse.json({ error: "Delete failed" }, { status: 500 })
			}
			return NextResponse.json({ data: { deleted: -1 } })
		}

		// Delete by id from body or query
		let id: string | null = null
		try {
			const body = await request.json().catch(() => ({}))
			id = body?.id ?? null
		} catch {
			id = null
		}
		if (!id) id = url.searchParams.get("id")

		if (!id) {
			return NextResponse.json({ error: "Missing id or convo" }, { status: 400 })
		}

		if (!supabase) {
			const ok = deleteTicket(id)
			return NextResponse.json({ data: { deleted: ok ? 1 : 0 } })
		}

		const { error } = await supabase.from("support_tickets").delete().eq("id", id)
		if (error) {
			console.error("Supabase delete id error:", error)
			return NextResponse.json({ error: "Delete failed" }, { status: 500 })
		}
		return NextResponse.json({ data: { deleted: 1 } })
	} catch (err) {
		console.error("DELETE /api/support error:", err)
		return NextResponse.json({ error: "Internal server error" }, { status: 500 })
	}
}

export async function POST(request: NextRequest) {
	try {
		let supabase = null
		try {
			supabase = await createClient()
		} catch (clientErr) {
			console.warn('Supabase client not available, using local store fallback', clientErr)
		}

		const body = await request.json().catch(() => ({}))
		const subject = body?.subject ?? "Member message"
		const message = body?.message ?? ""

		if (!message) {
			return NextResponse.json({ error: "Message is required" }, { status: 400 })
		}

		if (!supabase) {
			// Persist to local store when Supabase isn't configured
			const localUserId = `local-${Date.now()}`
			const local = createTicket({ userId: localUserId, userEmail: "", subject, message })
			return NextResponse.json({ data: local })
		}

		const { data: userData } = await supabase.auth.getUser()
		const user = userData?.user

		const payload = {
			user_id: user?.id ?? null,
			user_email: user?.email ?? null,
			subject,
			message,
			status: "open",
			created_at: new Date().toISOString(),
		}

		try {
			const { data, error } = await supabase.from("support_tickets").insert(payload).select()
			if (error || !data) {
				throw error ?? new Error("No data returned from Supabase")
			}
			return NextResponse.json({ data: Array.isArray(data) ? data[0] : data })
		} catch (supabaseErr) {
			console.warn("Supabase insert failed, falling back to local store:", supabaseErr)
			const localUserId = user?.id ?? `local-${Date.now()}`
			const local = createTicket({ userId: localUserId, userEmail: user?.email ?? "", subject, message })
			return NextResponse.json({ data: local })
		}
	} catch (err) {
		console.error("POST /api/support error:", err)
		return NextResponse.json({ error: "Internal server error" }, { status: 500 })
	}
}
