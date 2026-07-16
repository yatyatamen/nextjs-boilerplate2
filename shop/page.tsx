"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function OrderRequestPage() {
  const search = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const itemId = search.get("itemId") ?? ""
  const itemName = search.get("itemName") ?? ""
  const category = search.get("category") ?? ""
  const price = search.get("price") ?? ""

  const [fullName, setFullName] = useState("")
  const [contactMethod, setContactMethod] = useState("whatsapp")
  const [contactValue, setContactValue] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (data?.user) setUserId(data.user.id)
        // full name may be stored in user_metadata depending on auth setup
        if (data?.user?.user_metadata?.full_name) setFullName(data.user.user_metadata.full_name)
      } catch (err) {
        // ignore
      }
    })()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !contactValue.trim()) return alert("Please provide your name and contact info")
    setLoading(true)
    try {
      const payload = {
        itemId,
        itemName,
        category,
        userId: userId ?? undefined,
        userName: fullName,
        contactMethod,
        contactValue,
        note,
        price,
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        alert("Order request submitted. We'll notify you via your chosen contact method.")
        router.push("/member-dashboard")
      } else {
        console.warn("Order API error:", json)
        alert("Unable to submit order request. Please try again later.")
      }
    } catch (err) {
      console.error(err)
      alert("Unexpected error submitting order request.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Request: {itemName}</h1>
      <p className="text-sm text-muted-foreground mb-4">Order Total: {price || "TBD"}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Full name</label>
          <input className="mt-1 w-full p-2 rounded bg-zinc-900 border border-zinc-800" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium">Contact method</label>
          <select className="mt-1 w-full p-2 rounded bg-zinc-900 border border-zinc-800" value={contactMethod} onChange={(e) => setContactMethod(e.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="instagram">Instagram DM</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Contact info (number, email, or IG handle)</label>
          <input className="mt-1 w-full p-2 rounded bg-zinc-900 border border-zinc-800" value={contactValue} onChange={(e) => setContactValue(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium">Note for staff</label>
          <textarea className="mt-1 w-full p-2 rounded bg-zinc-900 border border-zinc-800" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="flex items-center justify-between">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-[#E2AC28] text-black rounded">{loading ? "Sending..." : "Submit Request"}</button>
          <button type="button" onClick={() => router.back()} className="text-sm text-zinc-400">Cancel</button>
        </div>
      </form>

      <div className="mt-6 text-xs text-zinc-500">We will confirm pickup time via the contact method you provided.</div>
    </div>
  )
}
