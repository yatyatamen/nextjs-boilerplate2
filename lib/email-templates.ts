export type EmailTemplateKey =
  | "booking_confirmation"
  | "booking_reminder"
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
  announcement: {
    subject: "Announcement: {title}",
    body: `Hello everyone,\n\n{content}`,
  },
  session_alert: {
    subject: "New session posted: {title}",
    body: `A new {title} session has been posted and is ready for booking.\n\nDate: {date}\nTime: {time}\n\nPlease check the dashboard and book as soon as possible.`,
  },
  assessment: {
    subject: "Your assessment is ready",
    body: `Hello {memberName},\n\nYour latest assessment has been posted and your tier is now set to {level}.\n\nPlease check the dashboard to review your feedback.`,
  },
  absence: {
    subject: "Attendance update: {sessionTitle}",
    body: `Hello {memberName},\n\nWe have marked your attendance for {sessionTitle} as absent.\n\nIf this was a mistake, please contact club leaders as soon as possible.`,
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
  const stored = getStoredEmailTemplates()

  return {
    booking_confirmation: {
      subject: stored.booking_confirmation?.subject ?? DEFAULT_EMAIL_TEMPLATES.booking_confirmation.subject,
      body: stored.booking_confirmation?.body ?? DEFAULT_EMAIL_TEMPLATES.booking_confirmation.body,
    },
    booking_reminder: {
      subject: stored.booking_reminder?.subject ?? DEFAULT_EMAIL_TEMPLATES.booking_reminder.subject,
      body: stored.booking_reminder?.body ?? DEFAULT_EMAIL_TEMPLATES.booking_reminder.body,
    },
    announcement: {
      subject: stored.announcement?.subject ?? DEFAULT_EMAIL_TEMPLATES.announcement.subject,
      body: stored.announcement?.body ?? DEFAULT_EMAIL_TEMPLATES.announcement.body,
    },
    session_alert: {
      subject: stored.session_alert?.subject ?? DEFAULT_EMAIL_TEMPLATES.session_alert.subject,
      body: stored.session_alert?.body ?? DEFAULT_EMAIL_TEMPLATES.session_alert.body,
    },
    assessment: {
      subject: stored.assessment?.subject ?? DEFAULT_EMAIL_TEMPLATES.assessment.subject,
      body: stored.assessment?.body ?? DEFAULT_EMAIL_TEMPLATES.assessment.body,
    },
    absence: {
      subject: stored.absence?.subject ?? DEFAULT_EMAIL_TEMPLATES.absence.subject,
      body: stored.absence?.body ?? DEFAULT_EMAIL_TEMPLATES.absence.body,
    },
    shop_update: {
      subject: stored.shop_update?.subject ?? DEFAULT_EMAIL_TEMPLATES.shop_update.subject,
      body: stored.shop_update?.body ?? DEFAULT_EMAIL_TEMPLATES.shop_update.body,
    },
  }
}

export function saveEmailTemplateConfig(config: EmailTemplateConfig) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function applyTemplateText(text: string, replacements: Record<string, string | number | null | undefined>) {
  let result = text

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value ?? ""))
  }

  return result
}
