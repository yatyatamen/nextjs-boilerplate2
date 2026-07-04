import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AuthForm } from "@/components/auth/auth-form"
import { Logo, ShuttleIcon } from "@/components/brand"
import { CalendarDays, Trophy, Megaphone, ShoppingBag } from "lucide-react"

async function getSessionRedirect() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    return data?.role === "staff" ? "/staff-dashboard" : "/member-dashboard"
  } catch {
    return null
  }
}

const highlights = [
  { icon: CalendarDays, title: "Weekly schedule", desc: "See coached sessions and open play by skill level." },
  { icon: Trophy, title: "Track your level", desc: "Get coach feedback and watch your game improve." },
  { icon: Megaphone, title: "Club announcements", desc: "Never miss tournaments, tryouts, and events." },
  { icon: ShoppingBag, title: "Gear shop", desc: "Rackets, shuttles, and club apparel in one place." },
]

export default async function Page() {
  const target = await getSessionRedirect()
  if (target) redirect(target)

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand / hero panel */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-sidebar px-6 py-10 text-sidebar-foreground lg:w-[46%] lg:px-12 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary/15 blur-3xl"
        />

        <Logo onDark />

        <div className="relative z-10 my-10 lg:my-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1 text-xs font-medium text-sidebar-foreground/80">
            <ShuttleIcon className="h-3.5 w-3.5" /> YRDSB students only
          </span>
          <h1 className="mt-5 text-pretty text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Your home court for everything badminton.
          </h1>
          <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-sidebar-foreground/70 sm:text-base">
            Book sessions, follow your progress, and stay in the loop with the
            Westmount Badminton Club — all in one member portal.
          </p>

          <ul className="mt-8 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
            {highlights.map((h) => (
              <li
                key={h.title}
                className="flex items-start gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary-foreground">
                  <h.icon className="h-4 w-4 text-primary" />
                </span>
                <div>
                  <p className="text-sm font-medium">{h.title}</p>
                  <p className="text-xs text-sidebar-foreground/60">{h.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-sidebar-foreground/50">
          Westmount Secondary School · Athletics Department
        </p>
      </section>

      {/* Auth panel */}
      <section className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome to the club
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in or register with your YRDSB school account to continue.
            </p>
          </div>
          <AuthForm />
        </div>
      </section>
    </main>
  )
}
