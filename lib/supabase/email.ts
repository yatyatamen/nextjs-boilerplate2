import { Resend } from "resend"
import { applyTemplateText, getEmailTemplateConfig } from "@/lib/email-templates"

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

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
        <p>${message.replace(/\n/g, "<br />")}</p>
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
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY is not configured" }
  }

  const from = process.env.EMAIL_FROM || "no-reply@yourdomain.com"
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to]

  if (recipients.length === 0) {
    return { ok: false, error: "No recipients" }
  }

  try {
    const result = await resend.emails.send({
      from,
      to: recipients,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    })

    if (result.error) {
      return { ok: false, error: result.error.message }
    }

    return { ok: true, id: result.data?.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to send email",
    }
  }
}

export async function sendSessionBookingReminderEmail({
  to,
  memberName,
  sessionTitle,
  sessionDate,
  sessionTime,
}: {
  to: string
  memberName: string
  sessionTitle: string
  sessionDate: string
  sessionTime: string
}) {
  const template = getEmailTemplateConfig().booking_reminder
  const subject = applyTemplateText(template.subject, { memberName, sessionTitle, sessionDate, sessionTime })
  const text = applyTemplateText(template.body, { memberName, sessionTitle, sessionDate, sessionTime })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Session reminder</h2>
        <p>${text.replace(/\n/g, "<br />")}</p>
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
}: {
  to: string
  memberName: string
  sessionTitle: string
  sessionDate: string
  sessionTime: string
}) {
  const template = getEmailTemplateConfig().booking_confirmation
  const subject = applyTemplateText(template.subject, { memberName, sessionTitle, sessionDate, sessionTime })
  const text = applyTemplateText(template.body, { memberName, sessionTitle, sessionDate, sessionTime })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Booking confirmed</h2>
        <p>${text.replace(/\n/g, "<br />")}</p>
      </div>
    `,
    text,
  })
}

export async function sendAnnouncementEmail({
  to,
  title,
  content,
}: {
  to: string
  title: string
  content: string
}) {
  const template = getEmailTemplateConfig().announcement
  const subject = applyTemplateText(template.subject, { title, content })
  const text = applyTemplateText(template.body, { title, content })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>${title}</h2>
        <p>${text.replace(/\n/g, "<br />")}</p>
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
}: {
  to: string
  title: string
  date: string
  time: string
}) {
  const template = getEmailTemplateConfig().session_alert
  const subject = applyTemplateText(template.subject, { title, date, time })
  const text = applyTemplateText(template.body, { title, date, time })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>New session available</h2>
        <p>${text.replace(/\n/g, "<br />")}</p>
      </div>
    `,
    text,
  })
}

export async function sendAssessmentEmail({
  to,
  memberName,
  level,
}: {
  to: string
  memberName: string
  level: string
}) {
  const template = getEmailTemplateConfig().assessment
  const subject = applyTemplateText(template.subject, { memberName, level })
  const text = applyTemplateText(template.body, { memberName, level })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Assessment update</h2>
        <p>${text.replace(/\n/g, "<br />")}</p>
      </div>
    `,
    text,
  })
}

export async function sendAbsenceEmail({
  to,
  memberName,
  sessionTitle,
}: {
  to: string
  memberName: string
  sessionTitle: string
}) {
  const template = getEmailTemplateConfig().absence
  const subject = applyTemplateText(template.subject, { memberName, sessionTitle })
  const text = applyTemplateText(template.body, { memberName, sessionTitle })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>Attendance recorded</h2>
        <p>${text.replace(/\n/g, "<br />")}</p>
      </div>
    `,
    text,
  })
}

export async function sendShopUpdateEmail({
  to,
  itemName,
}: {
  to: string
  itemName: string
}) {
  const template = getEmailTemplateConfig().shop_update
  const subject = applyTemplateText(template.subject, { itemName })
  const text = applyTemplateText(template.body, { itemName })

  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>New item in the shop</h2>
        <p>${text.replace(/\n/g, "<br />")}</p>
      </div>
    `,
    text,
  })
}
