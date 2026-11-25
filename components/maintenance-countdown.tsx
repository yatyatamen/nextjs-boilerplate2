"use client"

import { useEffect, useState } from "react"
import { MAINTENANCE_REOPEN_AT } from "@/lib/maintenance"

function getRemainingTime() {
  const total = Math.max(0, Date.parse(MAINTENANCE_REOPEN_AT) - Date.now())
  return {
    total,
    hours: Math.floor(total / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000),
  }
}

export function MaintenanceCountdown() {
  const [remaining, setRemaining] = useState(getRemainingTime)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const next = getRemainingTime()
      setRemaining(next)
      if (next.total === 0) window.location.replace("/")
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div
      aria-label={`${remaining.hours} hours, ${remaining.minutes} minutes, and ${remaining.seconds} seconds until reopening`}
      aria-live="off"
      className="mt-3 flex items-center gap-2"
    >
      {[
        { value: remaining.hours, label: "Hours" },
        { value: remaining.minutes, label: "Minutes" },
        { value: remaining.seconds, label: "Seconds" },
      ].map(({ value, label }) => (
        <div key={label} className="min-w-20 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-center">
          <span className="block font-mono text-2xl font-bold tabular-nums text-white">{String(value).padStart(2, "0")}</span>
          <span className="mt-1 block text-[10px] uppercase tracking-[0.15em] text-zinc-500">{label}</span>
        </div>
      ))}
    </div>
  )
}
