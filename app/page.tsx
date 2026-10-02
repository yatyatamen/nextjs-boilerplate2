"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, Button } from "@/components/ui/primitives"
import { isValidSchoolEmail, ALLOWED_DOMAIN } from "@/lib/types"
import { CalendarDays, Trophy, Megaphone, ShoppingBag, Mail, Lock, Loader2, UserRound } from "lucide-react"

const DOMAIN_ERROR = `Only YRDSB school email addresses (${ALLOWED_DOMAIN}) are allowed.`
const AUTH_REDIRECT_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
const FALLBACK_AUTH_REDIRECT_URL = "https://wci-badminton-club-git-main-wcibadmintonclub.vercel.app"

function isDuplicateEmailError(error: { message?: string; status?: number } | null | undefined) {
  const message = `${error?.message ?? ""}`.toLowerCase()
  const rawError = `${JSON.stringify(error) ?? ""}`.toLowerCase()
  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("already in use") ||
    message.includes("user already registered") ||
    rawError.includes("already registered") ||
    rawError.includes("already exists") ||
    rawError.includes("already in use") ||
    rawError.includes("user already registered") ||
    error?.status === 400 ||
    error?.status === 409 ||
    error?.status === 422
  )
}

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [isRegister, setIsRegister] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const searchParams = new URLSearchParams(window.location.search)
    const hash = window.location.hash
    const isRecoveryLink =
      searchParams.get("type") === "recovery" ||
      searchParams.get("code") !== null ||
      hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      hash.includes("refresh_token")

    if (isRecoveryLink) {
      const nextUrl = `/reset-password${window.location.search}${window.location.hash}`
      router.replace(nextUrl)
    }
  }, [router])

  async function emailAlreadyExists(email: string) {
    try {
      const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
      if (!response.ok) {
        console.warn("Email existence check failed", await response.text())
        return false
      }
      const json = await response.json()
      return json.exists === true
    } catch (error) {
      console.warn("Email existence check request failed", error)
      return false
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const normalizedEmail = email.trim()

    if (isRegister) {
      const normalizedFullName = fullName.trim()
      if (!normalizedFullName) {
        setError("Please enter your full name.")
        setLoading(false)
        return
      }

      if (!isValidSchoolEmail(normalizedEmail)) {
        setError(DOMAIN_ERROR)
        setLoading(false)
        return
      }

      const exists = await emailAlreadyExists(normalizedEmail)
      if (exists) {
        setError("This email is already in use. Please sign in instead.")
        setIsRegister(false)
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${AUTH_REDIRECT_URL?.replace(/\/$/, "") || FALLBACK_AUTH_REDIRECT_URL}/auth/callback`,
          data: {
            full_name: normalizedFullName,
            role: "member",
            level: "member",
          },
        },
      })
      console.debug("supabase signUp response", { data, error })

      const duplicateSignup =
        isDuplicateEmailError(error) ||
        (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)

      if (duplicateSignup) {
        setError("This email is already in use. Please sign in instead.")
        setIsRegister(false)
        setLoading(false)
      } else if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        if (data.user && data.session) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            id: data.user.id,
            email: normalizedEmail,
            full_name: normalizedFullName,
            role: "member",
            level: "member",
            marketing_emails: true,
          }, { onConflict: "id" })
          if (profileError) console.error("New member profile save failed:", profileError.message)
        }
        setError(" Registration successful! Please verify your email via the confirmation link sent to your inbox to activate your account.")
        setIsRegister(false)
        setLoading(false)
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
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
        } else if (profile?.role === "teacher") {
          window.location.href = "/teacher-dashboard"
        } else if (profile?.role === "leader") {
          window.location.href = "/leader-dashboard"
        } else {
          window.location.href = "/member-dashboard"
        }
      }
    }
  }

  return (
    <div className="min-h-screen w-full text-zinc-100 font-sans antialiased flex flex-col justify-between p-5 sm:p-6 md:p-12 relative overflow-hidden" style={{
      backgroundImage: `url('https://jmlhdtltucwhxrrunenl.supabase.co/storage/v1/object/public/pics/Screenshot%202026-07-14%201459121.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>
      {/* Background overlay for better text readability */}
      <div className="absolute inset-0 bg-black/30 md:bg-black/20 pointer-events-none" />

      <div className="flex items-center gap-3 z-10 relative">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-zinc-900 border border-[#14B8A6]/50 text-[#14B8A6] shadow-lg shadow-[#14B8A6]/20">
          <img
            src="https://jmlhdtltucwhxrrunenl.supabase.co/storage/v1/object/public/pics/ChatGPT%20Image%20Jul%2018,%202026,%2007_08_37%20PM.png"
            alt="Westmount Wolves club logo"
            className="h-full w-full rounded-sm object-contain"
          />
        </div>
        <div>
          <h1 className="text-sm font-black uppercase tracking-wider text-white leading-none">🐺 Westmount Wolves</h1>
          <p className="text-xs font-mono text-[#99f7ed] tracking-tight mt-1">Badminton Portal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center my-auto max-w-7xl w-full mx-auto z-10">
        <div className="lg:col-span-7 flex flex-col gap-7">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-950/90 text-[#14B8A6] border border-zinc-700">
              🐺 #BeWolves · Westmount Students Only
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight uppercase leading-none">
            Your home court for <br />
            <span className="text-[#99f7ed]">everything badminton.</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-12 sm:mt-14">
            <FeatureCard icon={CalendarDays} title="Weekly schedule" desc="View and book session schedules, join for fun sessions, and sign up for trainings." />
            <FeatureCard icon={Trophy} title="Track your level" desc="Complete assessments, track progress, and review coach feedback to level up." />
            <FeatureCard icon={Megaphone} title="Club announcements" desc="Never miss sessions and events." />
            <FeatureCard icon={ShoppingBag} title="Gear & Maintenance" desc="Upgrade your rackets, replace grips, and request re-gripping services." />
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center lg:justify-end relative">
          <Card className="relative w-full max-w-md border border-[#14B8A6]/50 bg-zinc-950/70 backdrop-blur-xl p-5 sm:p-8 rounded-sm shadow-2xl shadow-[#14B8A6]/20 overflow-hidden">
            {/* Card background accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#14B8A6]/5 to-transparent pointer-events-none" />
            
            <div className="relative mb-6">
              <h3 className="text-xl font-extrabold text-white uppercase tracking-tight">Pack Access</h3>
              <p className="text-sm text-zinc-100 mt-1">WCI Students Only · School Credentials Required</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-sm border border-zinc-800/60 mb-6 relative">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(null); }}
                className={`py-2.5 text-sm font-mono font-bold uppercase tracking-wider rounded-sm transition-all ${
                  !isRegister ? "bg-gradient-to-r from-[#14B8A6] to-cyan-500 text-black border border-[#14B8A6] shadow-lg shadow-[#14B8A6]/50" : "text-zinc-200 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(null); }}
                className={`py-2.5 text-sm font-mono font-bold uppercase tracking-wider rounded-sm transition-all ${
                  isRegister ? "bg-gradient-to-r from-[#14B8A6] to-cyan-500 text-black border border-[#14B8A6] shadow-lg shadow-[#14B8A6]/50" : "text-zinc-200 hover:text-white"
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className={`mb-4 rounded-sm border px-3 py-3 text-center font-mono text-xs uppercase tracking-wide ${
                error.includes("successful") ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-400" : "border-red-900/50 bg-red-950/20 text-red-400"
              }`}>
                {error}
              </div>
            )}

            <form onSubmit={handleAuth} className="flex flex-col gap-4 relative">
              {isRegister && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-white font-mono">Full Name</label>
                  <div className="relative flex items-center">
                    <UserRound className="absolute left-3 h-4 w-4 text-[#14B8A6]/60" />
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder=" "
                      className="w-full bg-zinc-950 text-white border border-zinc-700 outline-none rounded-sm py-3 pl-10 pr-3 text-sm font-mono transition-all focus:border-[#14B8A6] focus:shadow-lg focus:shadow-[#14B8A6]/30 placeholder-zinc-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-white font-mono">School Email</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 h-4 w-4 text-[#14B8A6]/60" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="@gapps.yrdsb.ca"
                    className="w-full bg-zinc-950 text-white border border-zinc-700 outline-none rounded-sm py-3 pl-10 pr-3 text-sm font-mono transition-all focus:border-[#14B8A6] focus:shadow-lg focus:shadow-[#14B8A6]/30 placeholder-zinc-400"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-white font-mono">Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 h-4 w-4 text-[#14B8A6]/60" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 text-white border border-zinc-700 outline-none rounded-sm py-3 pl-10 pr-3 text-sm font-mono transition-all focus:border-[#14B8A6] focus:shadow-lg focus:shadow-[#14B8A6]/30 placeholder-zinc-400"
                  />
                </div>
              </div>

              {!isRegister && (
                <Link
                  href="/auth/forgot-password"
                  className="text-right text-sm font-mono text-[#14B8A6] hover:text-white"
                >
                  Reset password
                </Link>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-[#14B8A6] to-cyan-500 text-black hover:from-[#0D9488] hover:to-cyan-600 disabled:from-zinc-800 disabled:to-zinc-700 disabled:text-zinc-500 font-extrabold font-mono text-sm uppercase tracking-widest py-3.5 rounded-sm border-none cursor-pointer shadow-lg shadow-[#14B8A6]/50 hover:shadow-[#14B8A6]/70 transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Authorizing...
                  </span>
                ) : isRegister ? (
                  "Join the Pack"
                ) : (
                  "Enter the Den"
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="text-center border-t border-zinc-900 pt-4 mt-8 z-10">
        <p className="text-xs font-mono uppercase tracking-wide text-white">
          Westmount Collegiate Institute · Badminton Club Department
        </p>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card className="flex items-start gap-4 p-4 sm:p-5 border border-white/25 bg-transparent backdrop-blur-md rounded-sm shadow-lg shadow-black/10">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-zinc-900 border border-zinc-700 text-[#14B8A6]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h4 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h4>
        <p className="text-sm text-zinc-100 leading-relaxed">{desc}</p>
      </div>
    </Card>
  )
}