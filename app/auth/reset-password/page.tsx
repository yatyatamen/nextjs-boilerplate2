"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button, Input, Label, Card } from "@/components/ui/primitives"
import { Lock, Loader2, ArrowLeft } from "lucide-react"

const BACKGROUND_IMAGE =
  "https://jmlhdtltucwhxrrunenl.supabase.co/storage/v1/object/public/pics/Screenshot%202026-07-14%201459121.png"

function hasRecoveryParams() {
  if (typeof window === "undefined") return false

  const searchParams = new URLSearchParams(window.location.search)
  const hash = window.location.hash
  const recoveryType = searchParams.get("type")
  const code = searchParams.get("code")

  return (
    recoveryType === "recovery" ||
    code !== null ||
    hash.includes("type=recovery") ||
    hash.includes("access_token") ||
    hash.includes("refresh_token")
  )
}

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [loading, setLoading] = useState(false)
  const [isLinkReady, setIsLinkReady] = useState(false)
  const [verifyingLink, setVerifyingLink] = useState(true)

  useEffect(() => {
    let isMounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || session) {
        setIsLinkReady(true)
        setVerifyingLink(false)
        setMessage("Reset link verified. Please enter your new password.")
        setStatus("idle")
      } else if (event === "SIGNED_OUT") {
        setIsLinkReady(false)
        setVerifyingLink(false)
        setMessage("This reset link is invalid or has expired. Please request a new reset email.")
        setStatus("error")
      }
    })

    const verifyRecoveryLink = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get("code")
      const hasRecoveryLink = hasRecoveryParams()

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!isMounted) return

        if (!error) {
          setIsLinkReady(true)
          setVerifyingLink(false)
          setMessage("Reset link verified. Please enter your new password.")
          setStatus("idle")
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!isMounted) return

      if (session || hasRecoveryLink) {
        setIsLinkReady(true)
        setVerifyingLink(false)
        setMessage("Reset link verified. Please enter your new password.")
        setStatus("idle")
      } else {
        setIsLinkReady(false)
        setVerifyingLink(false)
        setMessage("This reset link is invalid or has expired. Please request a new reset email.")
        setStatus("error")
      }
    }

    void verifyRecoveryLink()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setStatus("idle")

    if (!isLinkReady) {
      setStatus("error")
      setMessage("This reset link is invalid or has expired. Please request a new reset email.")
      return
    }

    if (password.length < 6) {
      setStatus("error")
      setMessage("Password must be at least 6 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setStatus("error")
      setMessage("Passwords do not match.")
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus("error")
      setMessage(error.message)
    } else {
      setStatus("success")
      setMessage("Your password has been updated. Redirecting you back to sign in...")
      window.setTimeout(() => {
        window.location.href = "/"
      }, 1200)
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen w-full text-zinc-100 font-sans antialiased flex flex-col justify-center p-6 relative overflow-hidden"
      style={{
        backgroundImage: `url('${BACKGROUND_IMAGE}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <main className="relative z-10 mx-auto w-full max-w-md">
        <Card className="relative overflow-hidden rounded-xl border border-[#14B8A6]/30 bg-zinc-900/80 p-8 shadow-2xl shadow-[#14B8A6]/20">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white">
              Reset password
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Enter your new password after clicking the link in your email.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {message && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  status === "success"
                    ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-300"
                    : "border-red-900/50 bg-red-950/20 text-red-300"
                }`}
              >
                {message}
              </div>
            )}

            <Button type="submit" disabled={loading || verifyingLink || !isLinkReady} className="w-full">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Updating password...
                </span>
              ) : verifyingLink ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying reset link...
                </span>
              ) : (
                "Update password"
              )}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-3 text-center text-sm text-zinc-400">
            <Link href="/" className="inline-flex items-center justify-center gap-2 text-[#14B8A6] hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        </Card>
      </main>
    </div>
  )
}
