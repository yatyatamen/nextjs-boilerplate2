import nodemailer from "nodemailer"
import { applyTemplateText, getEmailTemplateConfig, type EmailTemplate } from "@/lib/email-templates"

const gmailUser = process.env.GMAIL_USER?.trim() || process.env.EMAIL_USER?.trim()
const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD)?.trim().replace(/\s+/g, "")
const emailFrom = process.env.EMAIL_FROM?.trim() || gmailUser || ""
const smtpHost = (process.env.EMAIL_HOST || process.env.SMTP_HOST || "smtp.gmail.com").trim()
const smtpPortValue = Number(process.env.EMAIL_PORT ?? process.env.SMTP_PORT ?? "587")
const smtpPort = Number.isFinite(smtpPortValue) ? smtpPortValue : 587
const smtpSecure = (process.env.EMAIL_SECURE || process.env.SMTP_SECURE || "false").trim().toLowerCase() === "true"
const transporter = gmailUser && gmailAppPassword
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    })
  : null

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character)
}

function textToHtml(text: string) {
  return escapeHtml(text).replace(/\n/g, "<br />")
}

function getEmailConfigError() {
  if (!gmailUser) {
    return "No Gmail sender is configured. Add GMAIL_USER or EMAIL_USER in .env.local."
  }

  if (!gmailAppPassword) {
    return "No Gmail app password is configured. Add GMAIL_APP_PASSWORD or EMAIL_PASSWORD in .env.local."
  }

  return null
}

export async function sendSupportEmail({
  to,
  subject,
  message,
}: {
  to: string
  subject: string
  message: string
}) {
  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin-bottom: 12px;">New club message</h2>
        <p>${textToHtml(message)}</p>
      </div>
    `,
    text: message,
  })
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[]
  subject: string
  html: string
  text?: string
}) {
  const configError = getEmailConfigError()
  if (configError) {
    console.error(`[email] ${configError}`)
    return { ok: false, error: configError }
  }

  if (!transporter || !emailFrom) {
    return { ok: false, error: "Gmail sender is not configured." }
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to]

  if (recipients.length === 0) {
    return { ok: false, error: "No recipients" }
  }

  try {
    const result = await transporter.sendMail({
      from: emailFrom,
      to: recipients,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    })

    if (result.rejected && result.rejected.length > 0) {
      console.error("[email] Gmail rejected the message:", result.rejected)
      return { ok: false, error: `Gmail rejected recipients: ${result.rejected.join(", ")}` }
    }

    return { ok: true, id: result.messageId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send email"
    console.error("[email] send failed:", message)
    return {
      ok: false,
      error: message,
    }
  }
}

export async function sendSessionBookingReminderEmail({
  to,
  memberName,
  sessionTitle,
  sessionDate,
  sessionTime,
  template,
}: {
  to: string
  memberName: string
  sessionTitle: string
  sessionDate: string
  sessionTime: string
  template?: EmailTemplate
}) {
  const selectedTemplate = template ?? getEmailTemplateConfig().booking_reminder
  const subject = applyTemplateText(selectedTemplate.subject, { memberName, sessionTitle, sessionDate, sessionTime })
  const text = applyTemplateText(selectedTemplate.body, { memberName, sessionTitle, sessionDate, sessionTime })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Session reminder</h2>
        <p>${textToHtml(text)}</p>
      </div>
    `,
    text,
  })
}

export async function sendSessionBookingConfirmationEmail({
  to,
  memberName,
  sessionTitle,
  sessionDate,
  sessionTime,
  template,
}: {
  to: string
  memberName: string
  sessionTitle: string
  sessionDate: string
  sessionTime: string
  template?: EmailTemplate
}) {
  const selectedTemplate = template ?? getEmailTemplateConfig().booking_confirmation
  const subject = applyTemplateText(selectedTemplate.subject, { memberName, sessionTitle, sessionDate, sessionTime })
  const text = applyTemplateText(selectedTemplate.body, { memberName, sessionTitle, sessionDate, sessionTime })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Booking confirmed</h2>
        <p>${textToHtml(text)}</p>
      </div>
    `,
    text,
  })
}

export async function sendAnnouncementEmail({
  to,
  title,
  content,
  template,
}: {
  to: string
  title: string
  content: string
  template?: EmailTemplate
}) {
  const selectedTemplate = template ?? getEmailTemplateConfig().announcement
  const subject = applyTemplateText(selectedTemplate.subject, { title, content })
  const text = applyTemplateText(selectedTemplate.body, { title, content })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>${escapeHtml(title)}</h2>
        <p>${textToHtml(text)}</p>
      </div>
    `,
    text,
  })
}

export async function sendSessionAlertEmail({
  to,
  title,
  date,
  time,
  template,
}: {
  to: string
  title: string
  date: string
  time: string
  template?: EmailTemplate
}) {
  const selectedTemplate = template ?? getEmailTemplateConfig().session_alert
  const replacements = { title, sessionTitle: title, date, time, sessionDate: date, sessionTime: time }
  const subject = applyTemplateText(selectedTemplate.subject, replacements)
  const text = applyTemplateText(selectedTemplate.body, replacements)

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>New session available</h2>
        <p>${textToHtml(text)}</p>
      </div>
    `,
    text,
  })
}

export async function sendAssessmentEmail({
  to,
  memberName,
  level,
  template,
}: {
  to: string
  memberName: string
  level: string
  template?: EmailTemplate
}) {
  const selectedTemplate = template ?? getEmailTemplateConfig().assessment
  const subject = applyTemplateText(selectedTemplate.subject, { memberName, level })
  const text = applyTemplateText(selectedTemplate.body, { memberName, level })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Assessment update</h2>
        <p>${textToHtml(text)}</p>
      </div>
    `,
    text,
  })
}

export async function sendAbsenceEmail({
  to,
  memberName,
  sessionTitle,
  sessionDate,
  sessionTime,
  template,
}: {
  to: string
  memberName: string
  sessionTitle: string
  sessionDate?: string
  sessionTime?: string
  template?: EmailTemplate
}) {
  const selectedTemplate = template ?? getEmailTemplateConfig().absence
  const subject = applyTemplateText(selectedTemplate.subject, { memberName, sessionTitle, sessionDate, sessionTime })
  const text = applyTemplateText(selectedTemplate.body, { memberName, sessionTitle, sessionDate, sessionTime })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Attendance recorded</h2>
        <p>${textToHtml(text)}</p>
      </div>
    `,
    text,
  })
}

export async function sendShopUpdateEmail({
  to,
  itemName,
  template,
}: {
  to: string
  itemName: string
  template?: EmailTemplate
}) {
  const selectedTemplate = template ?? getEmailTemplateConfig().shop_update
  const subject = applyTemplateText(selectedTemplate.subject, { itemName })
  const text = applyTemplateText(selectedTemplate.body, { itemName })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>New item in the shop</h2>
        <p>${textToHtml(text)}</p>
      </div>
    `,
    text,
  })
}
