"use client"

import type { LucideIcon } from "lucide-react"
import { Logo } from "@/components/brand"
import { LogoutButton } from "@/components/dashboard/logout-button"
import { Badge } from "@/components/ui/primitives"
import { cn } from "@/lib/utils"

export type NavItem = {
  key: string
  label: string
  icon: LucideIcon
}

export function DashboardShell({
  navItems,
  activeKey,
  onChange,
  displayName,
  subtitle,
  badgeLabel,
  children,
}: {
  navItems: NavItem[]
  activeKey: string
  onChange: (key: string) => void
  displayName: string
  subtitle: string
  badgeLabel?: string
  children: React.ReactNode
}) {
  const initials =
    displayName
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "WB"

  const activeLabel = navItems.find((n) => n.key === activeKey)?.label ?? ""

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo onDark />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const active = item.key === activeKey
            return (
              <button
                key={item.key}
                onClick={() => onChange(item.key)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {subtitle}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo showText={false} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground sm:text-lg">
                {activeLabel}
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {badgeLabel && (
              <Badge variant="accent" className="hidden sm:inline-flex">
                {badgeLabel}
              </Badge>
            )}
            <LogoutButton />
          </div>
        </header>

        {/* Mobile tab bar */}
        <div className="border-b border-border bg-background lg:hidden">
          <div className="flex gap-1 overflow-x-auto px-3 py-2 scrollbar-none shadow-inner">
            {navItems.map((item) => {
              const active = item.key === activeKey
              return (
                <button
                  key={item.key}
                  onClick={() => onChange(item.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}