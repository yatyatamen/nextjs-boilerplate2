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
  if (!sessionDate || !timeValue) return null

  const timeString = String(timeValue)
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

export function getSessionBookingRules(
  session: { date?: string | null; time?: string | null; max_capacity?: number | string | null; notes?: string | null },
  currentCount = 0,
  now = new Date(),
): SessionBookingRuleResult {
  const rawLimit = session.max_capacity
  const parsedLimit = typeof rawLimit === "string" ? Number(rawLimit) : typeof rawLimit === "number" ? rawLimit : null
  const limit = Number.isFinite(parsedLimit) && parsedLimit !== null && parsedLimit > 0 ? parsedLimit : null
  const start = parseSessionStart(session.date, session.time)
  const isFull = limit !== null && currentCount >= limit
  const bookingCutoff = start ? new Date(start.getTime() - 6 * 60 * 60 * 1000) : null
  const cancellationCutoff = start ? new Date(start.getTime() - 24 * 60 * 60 * 1000) : null

  const bookingBlocked = !!start && !!bookingCutoff && now >= bookingCutoff
  const cancellationBlocked = !!start && !!cancellationCutoff && now >= cancellationCutoff

  const sessionNotes = [
    session.notes?.trim() || "Session details will be provided by staff.",
    "Booking policy: members can only book before 6 hours remain until the session start. Please talk to the club leaders if you need help.",
    "Cancellation policy: bookings cannot be cancelled within 24 hours of the session start. Please talk to the club leaders if you need help.",
    limit !== null ? `Capacity limit: ${limit} members. This session is currently ${currentCount}/${limit} booked.` : "Capacity limit: no fixed member cap for this session.",
  ].join("\n\n")

  return {
    limit,
    currentCount,
    isFull,
    isBookingBlocked: bookingBlocked || isFull,
    bookingBlockReason: isFull
      ? "This session is full. Please wait for a cancellation before trying again."
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
