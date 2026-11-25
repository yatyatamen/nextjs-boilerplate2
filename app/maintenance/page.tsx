import type { Metadata } from "next"
import Image from "next/image"
import { MaintenanceCountdown } from "@/components/maintenance-countdown"
import { MAINTENANCE_REOPEN_AT, MAINTENANCE_REOPEN_LABEL } from "@/lib/maintenance"

export const metadata: Metadata = {
  title: "Scheduled Maintenance | WCI Badminton Club",
  description: `The website is temporarily unavailable and will reopen at ${MAINTENANCE_REOPEN_LABEL}.`,
}

export const dynamic = "force-dynamic"

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080b0a] px-5 py-12 text-white">
      <section className="flex w-full max-w-5xl flex-col gap-8 rounded-2xl border border-emerald-500/20 bg-zinc-950/80 p-7 shadow-2xl shadow-black/40 sm:p-10 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Scheduled maintenance
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">We’ll be back soon.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
            We’re making updates to the WCI Badminton Club website. The site is temporarily closed while we work.
          </p>

          <div className="mt-8 rounded-xl border border-zinc-800 bg-black/40 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">The website reopens</p>
            <time dateTime={MAINTENANCE_REOPEN_AT} className="mt-2 block text-xl font-semibold text-emerald-300 sm:text-2xl">
              2:00 PM Toronto time
            </time>
            <p className="mt-1 text-sm text-zinc-400">Wednesday, November 25, 2026</p>

            <div className="mt-6 border-t border-zinc-800 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Time remaining</p>
              <MaintenanceCountdown />
            </div>
          </div>

          <p className="mt-6 text-sm text-zinc-500">
            The website will reopen automatically at the scheduled time. Thank you for your patience.
          </p>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-xs shrink-0 overflow-hidden rounded-xl bg-white lg:mx-0">
          <Image
            src="/maintenance-amen-ng.png"
            alt="Badminton mascot with a racket and a message to join the team and buy goggles"
            fill
            sizes="(min-width: 1024px) 320px, 100vw"
            className="object-contain"
          />
        </div>
      </section>
    </main>
  )
}
