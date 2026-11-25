"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ScheduleSession } from "@/lib/types"
import { Button, Card } from "@/components/ui/primitives"

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseDateKey(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function getInitialDate(sessions: ScheduleSession[]) {
  return sessions.map((session) => parseDateKey(session.date)).find((date) => date) ?? new Date()
}

export function ScheduleCalendar({
  sessions,
  renderSession,
}: {
  sessions: ScheduleSession[]
  renderSession?: (session: ScheduleSession) => ReactNode
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const firstDate = getInitialDate(sessions)
    return new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => getDateKey(getInitialDate(sessions)))
  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleSession[]>()
    for (const session of sessions) {
      const date = session.date?.slice(0, 10)
      if (!date || !parseDateKey(date)) continue
      grouped.set(date, [...(grouped.get(date) ?? []), session])
    }
    return grouped
  }, [sessions])

  const offset = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7
  const monthLabel = currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  const selectedSessions = sessionsByDate.get(selectedDate) ?? []

  function changeMonth(monthOffset: number) {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1)
    setCurrentMonth(nextMonth)
    setSelectedDate(getDateKey(nextMonth))
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-semibold">{monthLabel}</h3>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2 font-medium">{day}</div>
          ))}
          {Array.from({ length: cellCount }, (_, index) => {
            const dayNumber = index - offset + 1
            if (dayNumber < 1 || dayNumber > daysInMonth) {
              return <div key={`empty-${index}`} aria-hidden="true" className="min-h-16 rounded-lg sm:min-h-20" />
            }

            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNumber)
            const dateKey = getDateKey(date)
            const daySessions = sessionsByDate.get(dateKey) ?? []
            const selected = dateKey === selectedDate

            return (
              <button
                key={dateKey}
                type="button"
                aria-pressed={selected}
                aria-label={`${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}${daySessions.length ? `, ${daySessions.length} session${daySessions.length === 1 ? "" : "s"}` : ""}`}
                onClick={() => setSelectedDate(dateKey)}
                className={`min-h-16 rounded-lg border p-1 text-left transition-colors sm:min-h-20 sm:p-2 ${
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-transparent text-foreground hover:border-border hover:bg-muted/50"
                }`}
              >
                <span className="text-xs font-medium">{dayNumber}</span>
                {daySessions.length > 0 && (
                  <span className="mt-1 block truncate text-[10px] leading-4 text-primary sm:text-xs">
                    {daySessions.length} session{daySessions.length === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold">
          {parseDateKey(selectedDate)?.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h3>
        {selectedSessions.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No sessions scheduled for this date.</Card>
        ) : (
          <div className="space-y-3">
            {selectedSessions.map((session) => (
              <div key={session.id}>
                {renderSession ? renderSession(session) : (
                  <Card className="p-4">
                    <p className="font-medium">{session.title || "Training session"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{session.time || "Time TBD"}</p>
                    {session.notes && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{session.notes}</p>}
                  </Card>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
