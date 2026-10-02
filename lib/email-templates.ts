export type EmailTemplateKey =
  | "booking_confirmation"
  | "booking_reminder"
  | "booking_cancellation"
  | "booking_admin_cancellation"
  | "announcement"
  | "session_alert"
  | "assessment"
  | "absence"
  | "shop_update"

export type EmailTemplate = {
  subject: string
  body: string
}

export type EmailTemplateConfig = Record<EmailTemplateKey, EmailTemplate>

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateConfig = {
  booking_confirmation: {
    subject: "Booked: {sessionTitle}",
    body: `Hello {memberName},\n\nYour booking for {sessionTitle} is confirmed.\n\nDate: {sessionDate}\nTime: {sessionTime}\n\nBookings cannot be made within 6 hours of the session start, and cancellations are not allowed within 24 hours of the session start. Please talk to the club leaders if you need help.`,
  },
  booking_reminder: {
    subject: "Reminder: {sessionTitle} starts in 24 hours",
    body: `Hello {memberName},\n\nThis is a reminder that your booking for {sessionTitle} is coming up soon.\n\nDate: {sessionDate}\nTime: {sessionTime}\n\nPlease arrive on time and speak with club leaders if you need help before the session.`,
  },
  booking_cancellation: {
    subject: "Booking cancelled: {sessionTitle}",
    body: `Hello {memberName},\n\nYour booking for {sessionTitle} has been cancelled.\n\nDate: {sessionDate}\nTime: {sessionTime}\n\nIf you did not request this cancellation, please contact the club leaders.`,
  },
  booking_admin_cancellation: {
    subject: "Removed from session: {sessionTitle}",
    body: `Hello {memberName},\n\nA club administrator has removed your booking for {sessionTitle}.\n\nDate: {sessionDate}\nTime: {sessionTime}\n\nPlease contact the club leaders if you have questions.`,
  },
  announcement: {
    subject: "Announcement: {title}",
    body: `Hello everyone,\n\n{content}`,
  },
  session_alert: {
    subject: "New session posted: {sessionTitle}",
    body: `A new {sessionTitle} session has been posted and is ready for booking.\n\nDate: {sessionDate}\nTime: {sessionTime}\n\nPlease check the dashboard and book as soon as possible.`,
  },
  assessment: {
    subject: "Your assessment is ready",
    body: `Hello {memberName},\n\nYour latest assessment has been posted and your tier is now set to {level}.\n\nPlease check the dashboard to review your feedback.`,
  },
  absence: {
    subject: "Attendance update: {sessionTitle} - {sessionDate} {sessionTime}",
    body: `Hello {memberName},\n\nWe have marked your attendance for {sessionTitle} as absent.\n\nDate: {sessionDate}\nTime: {sessionTime}\n\nIf this was a mistake, please contact club leaders as soon as possible.`,
  },
  shop_update: {
    subject: "New shop item: {itemName}",
    body: `We just added {itemName} to the Wolves shop.\n\nCheck the dashboard to see the latest availability and pricing.`,
  },
}

const STORAGE_KEY = "club-auto-email-templates-v1"

function isEmailTemplateConfig(value: unknown): value is Partial<Record<EmailTemplateKey, Partial<EmailTemplate>>> {
  return !!value && typeof value === "object"
}

export function mergeEmailTemplateConfig(value: unknown): EmailTemplateConfig {
  const stored = isEmailTemplateConfig(value) ? value : {}
  const keys = Object.keys(DEFAULT_EMAIL_TEMPLATES) as EmailTemplateKey[]

  return Object.fromEntries(keys.map((key) => {
    const template = stored[key]
    return [key, {
      subject: typeof template?.subject === "string" ? template.subject : DEFAULT_EMAIL_TEMPLATES[key].subject,
      body: typeof template?.body === "string" ? template.body : DEFAULT_EMAIL_TEMPLATES[key].body,
    }]
  })) as EmailTemplateConfig
}

export function getStoredEmailTemplates(): Partial<Record<EmailTemplateKey, Partial<EmailTemplate>>> {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!isEmailTemplateConfig(parsed)) return {}

    return parsed
  } catch {
    return {}
  }
}

export function getEmailTemplateConfig(): EmailTemplateConfig {
  return mergeEmailTemplateConfig(getStoredEmailTemplates())
}

export function saveEmailTemplateConfig(config: EmailTemplateConfig) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Supabase is the source of truth; local storage is only a browser fallback.
  }
}

export function applyTemplateText(text: string, replacements: Record<string, string | number | null | undefined>) {
  let result = text

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value ?? ""))
  }

  return result
}
