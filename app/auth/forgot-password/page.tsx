"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { isValidSchoolEmail, ALLOWED_DOMAIN } from "@/lib/types"
import { Button, Input, Label, Card } from "@/components/ui/primitives"
import { Mail, Loader2, ArrowLeft } from "lucide-react"

const BACKGROUND_IMAGE =
  "https://jmlhdtltucwhxrrunenl.supabase.co/storage/v1/object/public/pics/Screenshot%202026-07-14%201459121.png"

function getResetRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "") + "/reset-password"
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`
  }

  return "/reset-password"
}

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setStatus("idle")
    setEmailError(null)

    const normalizedEmail = email.trim()
    if (!isValidSchoolEmail(normalizedEmail)) {
      setEmailError(`Please enter a valid YRDSB school email address ${ALLOWED_DOMAIN}`)
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getResetRedirectUrl(),
    })

    if (error) {
      setStatus("error")
      setMessage(error.message)
    } else {
      setStatus("success")
      setMessage(
        "If an account exists for this email, a password reset link has been sent. Check your inbox and return to the reset page.",
      )
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
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Enter the email address you used to sign in and we’ll send you a reset link.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-email">School email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={`you${ALLOWED_DOMAIN}`}
                  className="pl-9"
                  required
                />
              </div>
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
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

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending reset email...
                </span>
              ) : (
                "Send reset link"
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
