"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/primitives"
import { LogOut, Loader2 } from "lucide-react"

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size={compact ? "icon" : "sm"}
      onClick={handleLogout}
      disabled={loading}
      aria-label="Log out"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {!compact && <span>Log out</span>}
    </Button>
  )
}
