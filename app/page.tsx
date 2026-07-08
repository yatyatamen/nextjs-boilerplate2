"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/primitives"
import { Button } from "@/components/ui/primitives"
import { Trophy, Mail, Lock, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0B0C] px-4 font-sans antialiased selection:bg-[#E2AC28]/30 selection:text-[#E2AC28]">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(226,172,40,0.03)_0%,transparent_65%)] pointer-events-none" />

      <Card className="relative w-full max-w-md overflow-hidden border border-zinc-800/80 bg-zinc-900/40 p-8 backdrop-blur-md rounded-sm">
        {/* Top Header Section */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-zinc-900 border border-zinc-800 text-[#E2AC28] mb-4">
            <Trophy className="h-6 w-6 fill-[#E2AC28]/10" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#E2AC28]">
            WESTMOUNT BADMINTON CLUB
          </p>
          <h1 className="text-2xl font-extrabold text-white uppercase tracking-tight mt-1">
            Portal Access
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            YRDSB students only · Sign in to manage your court matrix
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-sm border border-red-900/50 bg-red-950/30 px-3 py-2 text-center font-mono text-[11px] uppercase tracking-wide text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
              School Email
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gapps.yrdsb.ca"
                className="w-full bg-zinc-950 text-white border border-zinc-800 outline-none rounded-sm py-2 pl-10 pr-3 text-xs font-mono transition-all focus:border-[#E2AC28]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 text-white border border-zinc-800 outline-none rounded-sm py-2 pl-10 pr-3 text-xs font-mono transition-all focus:border-[#E2AC28]"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#E2AC28] text-black hover:bg-[#D9A224] disabled:bg-zinc-800 disabled:text-zinc-500 font-extrabold font-mono text-xs uppercase tracking-widest py-2.5 rounded-sm transition-colors cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Authorizing...
              </span>
            ) : (
              "Initialize Session"
            )}
          </Button>
        </form>

        {/* Footer info line */}
        <div className="mt-8 text-center border-t border-zinc-800/60 pt-4">
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">
            Athletics Department · Westmount Secondary School
          </p>
        </div>
      </Card>
    </div>
  )
}