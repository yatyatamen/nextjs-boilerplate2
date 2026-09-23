export type SessionBookingRuleResult = {
  limit: number | null
  currentCount: number
  isFull: boolean
  isBookingBlocked: boolean
  bookingBlockReason: string | null
  isCancellationBlocked: boolean
  cancellationBlockReason: string | null
  sessionNotes: string
}

export function parseSessionDate(dateValue: string | null | undefined): Date | null {
  if (!dateValue) return null
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    const parsed = new Date(dateValue)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseSessionStart(dateValue: string | null | undefined, timeValue: string | null | undefined): Date | null {
  const sessionDate = parseSessionDate(dateValue)
  if (!sessionDate) return null

  const timeString = String(timeValue ?? "").trim()
  if (!timeString) {
    const start = new Date(sessionDate)
    start.setHours(0, 0, 0, 0)
    return start
  }

  const firstTimeMatch = timeString.match(/(\d{1,2}):(\d{2})/)
  if (!firstTimeMatch) return null

  const hour = Number(firstTimeMatch[1])
  const minute = Number(firstTimeMatch[2])
  const hasPm = /pm/i.test(timeString)
  const hasAm = /am/i.test(timeString)
  const normalizedHour = (() => {
    if (hasPm && hour !== 12) return hour + 12
    if (hasAm && hour === 12) return 0
    return hour
  })()

  const start = new Date(sessionDate)
  start.setHours(normalizedHour, minute, 0, 0)
  return Number.isNaN(start.getTime()) ? null : start
}

export function parseSessionEnd(dateValue: string | null | undefined, timeValue: string | null | undefined): Date | null {
  const sessionDate = parseSessionDate(dateValue)
  if (!sessionDate) return null

  const timeString = String(timeValue ?? "").trim()
  if (!timeString) {
    const end = new Date(sessionDate)
    end.setHours(23, 59, 59, 999)
    return end
  }

  const rangeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (rangeMatch) {
    const [, , , startPeriod, endHourValue, endMinuteValue, endPeriodValue] = rangeMatch
    const period = endPeriodValue || startPeriod
    const endHour = Number(endHourValue)
    const endMinute = Number(endMinuteValue)
    const normalizedHour = (() => {
      if (/pm/i.test(period ?? "") && endHour !== 12) return endHour + 12
      if (/am/i.test(period ?? "") && endHour === 12) return 0
      return endHour
    })()

    const end = new Date(sessionDate)
    end.setHours(normalizedHour, endMinute, 0, 0)
    return Number.isNaN(end.getTime()) ? null : end
  }

  const singleTimeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (singleTimeMatch) {
    const [, hourValue, minuteValue, meridiem] = singleTimeMatch
    const hour = Number(hourValue)
    const minute = Number(minuteValue)
    const normalizedHour = (() => {
      if (/pm/i.test(meridiem ?? "") && hour !== 12) return hour + 12
      if (/am/i.test(meridiem ?? "") && hour === 12) return 0
      return hour
    })()

    const end = new Date(sessionDate)
    end.setHours(normalizedHour, minute + 90, 0, 0)
    return Number.isNaN(end.getTime()) ? null : end
  }

  const end = new Date(sessionDate)
  end.setHours(23, 59, 59, 999)
  return end
}

export function isSessionEnded(
  session: { date?: string | null; time?: string | null } | null | undefined,
  now = new Date(),
) {
  const end = parseSessionEnd(session?.date, session?.time)
  return Boolean(end && now >= end)
}

export function getSessionBookingRules(
  session: { date?: string | null; time?: string | null; max_capacity?: number | string | null; notes?: string | null },
  currentCount = 0,
  now = new Date(),
): SessionBookingRuleResult {
  const rawLimit = session.max_capacity ?? null
  const parsedLimit = typeof rawLimit === "string" ? Number(rawLimit) : typeof rawLimit === "number" ? rawLimit : null
  const limit = Number.isFinite(parsedLimit) && parsedLimit !== null && parsedLimit > 0 ? parsedLimit : null
  const start = parseSessionStart(session.date, session.time)
  const ended = isSessionEnded(session, now)
  const isFull = limit !== null && currentCount >= limit
  const bookingCutoff = start ? new Date(start.getTime() - 6 * 60 * 60 * 1000) : null
  const cancellationCutoff = start ? new Date(start.getTime() - 24 * 60 * 60 * 1000) : null

  const bookingBlocked = ended || (!!start && !!bookingCutoff && now >= bookingCutoff)
  const cancellationBlocked = !!start && !!cancellationCutoff && now >= cancellationCutoff

  const sessionNotes = [
    session.notes?.trim() || "Session details will be provided by staff.",
    limit !== null ? `Spots left: ${Math.max(limit - currentCount, 0)} of ${limit}.` : "Spots left: no fixed member cap for this session.",
  ].join("\n\n")

  return {
    limit,
    currentCount,
    isFull,
    isBookingBlocked: bookingBlocked || isFull,
    bookingBlockReason: isFull
      ? "This session is full. Please wait for a cancellation before trying again."
      : ended
        ? "This session has ended and is no longer available for booking."
        : bookingBlocked
        ? "Booking is no longer available within 6 hours of the session start. Please talk to the club leaders if you need help."
        : null,
    isCancellationBlocked: cancellationBlocked,
    cancellationBlockReason: cancellationBlocked
      ? "Cancellation is disabled within 24 hours of the session start. Please talk to the club leaders if you need help."
      : null,
    sessionNotes,
  }
}

export function getSessionBookingNotes(
  session: { date?: string | null; time?: string | null; max_capacity?: number | string | null; notes?: string | null },
  currentCount = 0,
): string {
  return getSessionBookingRules(session, currentCount).sessionNotes
}

export function formatSessionBookingWindow(
  session: { date?: string | null; time?: string | null; max_capacity?: number | string | null; notes?: string | null },
  currentCount = 0,
): string {
  const result = getSessionBookingRules(session, currentCount)
  const summary: string[] = []
  if (result.isFull) summary.push("Session is full")
  if (result.isBookingBlocked && !result.isFull) summary.push("Booking window closed")
  if (result.isCancellationBlocked) summary.push("Cancellation window closed")
  return summary.length ? summary.join(" • ") : "Booking open"
}
