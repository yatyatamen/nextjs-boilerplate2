"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isValidSchoolEmail, ALLOWED_DOMAIN } from "@/lib/types"
import { Button, Input, Label } from "@/components/ui/primitives"
import { AlertCircle, Loader2, Mail } from "lucide-react"

type Mode = "login" | "register"

const DOMAIN_ERROR = `Only YRDSB school email addresses (${ALLOWED_DOMAIN}) are allowed to register.`

export function AuthForm() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>("login")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const emailValid = email.length === 0 || isValidSchoolEmail(email)
  const canSubmit = isValidSchoolEmail(email) && password.length >= 6

  function handleEmailChange(value: string) {
    setEmail(value)
    if (value.length > 0 && !isValidSchoolEmail(value)) {
      setEmailError(DOMAIN_ERROR)
    } else {
      setEmailError(null)
    }
  }

  async function routeByRole(
    supabase: ReturnType<typeof createClient>,
    userId: string,
  ) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (data?.role === "staff") {
      router.push("/staff-dashboard")
    } else {
      router.push("/member-dashboard")
    }
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!isValidSchoolEmail(email)) {
      setEmailError(DOMAIN_ERROR)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      if (mode === "register") {
        if (!fullName.trim()) {
          setFormError("Please enter your full name.")
          setLoading(false)
          return
        }
        if (password !== confirmPassword) {
          setFormError("Passwords do not match.")
          setLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        })

        if (error) {
          // 🛡️ Safe check if email already exists in Supabase Auth
          if (error.message.toLowerCase().includes("already registered") || error.status === 422) {
            setFormError("An account with this email already exists. Please sign in instead.")
          } else {
            setFormError(error.message)
          }
          return
        }

        const user = data.user
        if (user) {
          // 🛡️ Safe check when email confirmation is active.
          // If identities is an empty array, Supabase is telling us the email is taken without leaking data.
          if (user.identities && user.identities.length === 0) {
            setFormError("An account with this email already exists. Please sign in instead.")
            return
          }

          if (data.session) {
            router.push("/member-dashboard")
            router.refresh()
          } else {
            setFormError(
              "Account created! Please check your email inbox to confirm your verification link, then sign in.",
            )
            setMode("login")
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) {
          setFormError(error.message)
          return
        }
        if (data.user) {
          await routeByRole(supabase, data.user.id)
        }
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login")
            setFormError(null)
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === "login"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register")
            setFormError(null)
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === "register"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {mode === "register" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jordan Lee"
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">School email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onKeyUp={(e) => handleEmailChange((e.target as HTMLInputElement).value)}
              placeholder={`you${ALLOWED_DOMAIN}`}
              autoComplete="email"
              aria-invalid={!emailValid}
              className={`pl-9 ${!emailValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
              required
            />
          </div>
          {emailError && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{emailError}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
          {mode === "register" && (
            <p className="text-xs text-muted-foreground">
              Use at least 6 characters.
            </p>
          )}
        </div>

        {mode === "register" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={loading || !canSubmit}
          className="mt-1 w-full"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  )
}