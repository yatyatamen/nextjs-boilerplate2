import { Resend } from "resend"

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
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY is not configured" }
  }

  const from = process.env.EMAIL_FROM || "no-reply@yourdomain.com"

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
          <h2 style="margin-bottom: 12px;">New club message</h2>
          <p>${message.replace(/\n/g, "<br />")}</p>
        </div>
      `,
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
