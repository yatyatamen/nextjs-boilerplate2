git add .
git commit -m "fix: force update package configuration"
git push origin main

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Card, Button } from "@/components/ui/primitives"
import { CalendarDays, Trophy, Megaphone, ShoppingBag, Mail, Lock, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        setError("Registration successful! Please check your email or try logging in.")
        setLoading(false)
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else if (data?.user) {
        // 1. Fetch the user's role from the profiles table dynamically
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single()

        // 2. Direct them to the correct home base based on their role string
        if (profile?.role === "staff") {
          window.location.href = "/staff-dashboard"
        } else {
          window.location.href = "/member-dashboard"
        }
      }
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0B0C0E] text-zinc-100 font-sans antialiased flex flex-col justify-between p-6 md:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(20,184,166,0.04)_0%,transparent_50%)] pointer-events-none" />

      <div className="flex items-center gap-3 z-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-zinc-900 border border-zinc-800 text-[#14B8A6]">
          <Trophy className="h-4 w-4 fill-[#14B8A6]/10" />
        </div>
        <div>
          <h1 className="text-xs font-black uppercase tracking-wider text-white leading-none">Westmount</h1>
          <p className="text-[10px] font-mono text-[#14B8A6] tracking-tight mt-0.5">Collegiate Institute</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-auto max-w-7xl w-full mx-auto z-10">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-[#14B8A6] border border-zinc-800">
              🐺 #BeWolves · Westmount Students Only
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight uppercase leading-none">
            Your home court for <br />
            <span className="text-[#14B8A6]">everything badminton.</span>
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            Book sessions, follow your training metrics, and view real-time announcements inside the official Wolves badminton portal matrix.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <FeatureCard icon={CalendarDays} title="Weekly schedule" desc="See coached sessions and open play by skill level." />
            <FeatureCard icon={Trophy} title="Track your level" desc="Get coach feedback and watch your game improve." />
            <FeatureCard icon={Megaphone} title="Club announcements" desc="Never miss tournaments, tryouts, and events." />
            <FeatureCard icon={ShoppingBag} title="Gear shop" desc="Rackets, shuttles, and club apparel in one place." />
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center lg:justify-end relative">
          <Card className="relative w-full max-w-md border border-zinc-800/80 bg-zinc-900/40 p-8 backdrop-blur-md rounded-sm shadow-xl overflow-hidden">
            <div className="mb-6">
              <h3 className="text-xl font-extrabold text-white uppercase tracking-tight">Welcome to the Pack</h3>
              <p className="text-xs text-zinc-400 mt-1">Sign in or register with your school account.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-sm border border-zinc-800/60 mb-6">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(null); }}
                className={`py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all ${
                  !isRegister ? "bg-zinc-900 text-[#14B8A6] border border-zinc-800" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(null); }}
                className={`py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-sm transition-all ${
                  isRegister ? "bg-zinc-900 text-[#14B8A6] border border-zinc-800" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className={`mb-4 rounded-sm border px-3 py-2 text-center font-mono text-[10px] uppercase tracking-wide ${
                error.includes("successful") ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-400" : "border-red-900/50 bg-red-950/20 text-red-400"
              }`}>
                {error}
              </div>
            )}

            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">School Email</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gapps.yrdsb.ca"
                    className="w-full bg-zinc-950 text-white border border-zinc-800 outline-none rounded-sm py-2.5 pl-10 pr-3 text-xs font-mono transition-all focus:border-[#14B8A6]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 text-white border border-zinc-800 outline-none rounded-sm py-2.5 pl-10 pr-3 text-xs font-mono transition-all focus:border-[#14B8A6]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#14B8A6] text-black hover:bg-[#0D9488] disabled:bg-zinc-800 disabled:text-zinc-500 font-extrabold font-mono text-xs uppercase tracking-widest py-3 rounded-sm border-none cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Authorizing Profile...
                  </span>
                ) : isRegister ? (
                  "Create Credentials"
                ) : (
                  "Initialize Session"
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="text-center border-t border-zinc-900 pt-4 mt-8 z-10">
        <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
          Westmount Collegiate Institute · Athletics Department
        </p>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card className="flex items-start gap-4 p-4 border border-zinc-800/60 bg-zinc-900/20 rounded-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-zinc-900 border border-zinc-800/80 text-[#14B8A6]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex flex-col gap-0.5">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">{title}</h4>
        <p className="text-[11px] text-zinc-500 leading-normal">{desc}</p>
      </div>
    </Card>
  )
}