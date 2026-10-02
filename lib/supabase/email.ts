import nodemailer from "nodemailer"
import { randomUUID } from "node:crypto"
import { applyTemplateText, getEmailTemplateConfig, mergeEmailTemplateConfig, type EmailTemplate, type EmailTemplateKey } from "@/lib/email-templates"
import { createClient } from "@/lib/supabase/server"

const smtpUser = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim() || process.env.EMAIL_USER?.trim()
const smtpPassword = process.env.SMTP_PASSWORD?.trim() || (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD)?.trim().replace(/\s+/g, "")
const emailFrom = process.env.EMAIL_FROM?.trim() || smtpUser || ""
const smtpHost = (process.env.EMAIL_HOST || process.env.SMTP_HOST || "smtp.gmail.com").trim()
const smtpPortValue = Number(process.env.EMAIL_PORT ?? process.env.SMTP_PORT ?? "587")
const smtpPort = Number.isFinite(smtpPortValue) ? smtpPortValue : 587
const smtpSecureValue = (process.env.EMAIL_SECURE || process.env.SMTP_SECURE || "").trim().toLowerCase()
const smtpSecure = smtpSecureValue ? smtpSecureValue === "true" : smtpPort === 465
const transporter = smtpUser && smtpPassword
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })
  : null

async function getSavedEmailTemplate(key: EmailTemplateKey, fallback?: EmailTemplate) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("email_template_settings")
      .select("templates")
      .eq("id", true)
      .maybeSingle()

    if (!error && data?.templates) {
      return mergeEmailTemplateConfig(data.templates)[key]
    }
    if (error) console.warn("Unable to load saved email templates:", error.message)
  } catch (error) {
    console.warn("Unable to load saved email templates:", error)
  }

  return fallback ?? getEmailTemplateConfig()[key]
}

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
  if (!smtpUser) {
    return "No SMTP sender is configured. Add SMTP_USER, GMAIL_USER, or EMAIL_USER to the server environment."
  }

  if (!smtpPassword) {
    return "No SMTP password is configured. Add SMTP_PASSWORD, GMAIL_APP_PASSWORD, or EMAIL_PASSWORD to the server environment."
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
    console.error("[email] SMTP transport is unavailable", {
      hasUser: Boolean(smtpUser),
      hasPassword: Boolean(smtpPassword),
      hasFrom: Boolean(emailFrom),
      host: smtpHost,
      port: smtpPort,
    })
    return { ok: false, error: "Gmail sender is not configured." }
  }

  const recipients = (Array.isArray(to) ? to : [to]).map((recipient) => recipient.trim()).filter(Boolean)

  if (recipients.length === 0) {
    return { ok: false, error: "No recipients" }
  }

  try {
    const date = new Date().toISOString().slice(0, 10)
    const result = await transporter.sendMail({
      from: emailFrom,
      to: recipients,
      subject: `${subject} [${date}]`,
      html,
      text: text ?? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      headers: {
        "X-Entity-Ref-ID": randomUUID(),
      },
    })

    if (result.rejected && result.rejected.length > 0) {
      console.error("[email] SMTP rejected the message:", result.rejected)
      return { ok: false, error: `SMTP rejected recipients: ${result.rejected.join(", ")}` }
    }

    const acceptedRecipients = new Set((result.accepted ?? []).map((recipient) => String(recipient).trim().toLowerCase()))
    const notAccepted = recipients.filter((recipient) => !acceptedRecipients.has(recipient.toLowerCase()))
    if (notAccepted.length > 0) {
      console.error("[email] SMTP did not accept recipients:", notAccepted)
      return { ok: false, error: `SMTP did not accept recipients: ${notAccepted.join(", ")}` }
    }

    console.info("[email] SMTP accepted message:", { id: result.messageId, recipientCount: acceptedRecipients.size })

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
  const selectedTemplate = await getSavedEmailTemplate("booking_reminder", template)
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
  const selectedTemplate = await getSavedEmailTemplate("booking_confirmation", template)
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

export async function sendSessionBookingCancellationEmail({
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
  const selectedTemplate = await getSavedEmailTemplate("booking_cancellation", template)
  const replacements = { memberName, sessionTitle, sessionDate, sessionTime }
  const subject = applyTemplateText(selectedTemplate.subject, replacements)
  const text = applyTemplateText(selectedTemplate.body, replacements)

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Booking cancelled</h2>
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
  const selectedTemplate = await getSavedEmailTemplate("announcement", template)
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
  const selectedTemplate = await getSavedEmailTemplate("session_alert", template)
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
  const selectedTemplate = await getSavedEmailTemplate("assessment", template)
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
  const selectedTemplate = await getSavedEmailTemplate("absence", template)
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

export async function sendAttendanceUpdateEmail({
  to,
  memberName,
  sessionTitle,
  sessionDate,
  sessionTime,
  status,
  template,
}: {
  to: string
  memberName: string
  sessionTitle: string
  sessionDate?: string
  sessionTime?: string
  status: "present" | "absent" | "late"
  template?: EmailTemplate
}) {
  const templateKey = status === "absent" ? "absence" : "attendance_update"
  const selectedTemplate = await getSavedEmailTemplate(templateKey, template)
  const replacements = { memberName, sessionTitle, sessionDate, sessionTime, status }
  const subject = applyTemplateText(selectedTemplate.subject, replacements)
  const text = applyTemplateText(selectedTemplate.body, replacements)

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Attendance update</h2>
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
  const selectedTemplate = await getSavedEmailTemplate("shop_update", template)
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
