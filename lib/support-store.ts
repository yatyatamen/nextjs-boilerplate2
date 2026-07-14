type SupportStatus = "open" | "resolved"

export type SupportTicketRecord = {
  id: string
  user_id: string
  user_email: string
  subject: string
  message: string
  status: SupportStatus
  created_at: string
}

const ticketStore = new Map<string, SupportTicketRecord>()
let ticketCounter = 1

function createTicketId() {
  const value = `local-${Date.now()}-${ticketCounter}`
  ticketCounter += 1
  return value
}

export function listTicketsForUser(userId: string) {
  return Array.from(ticketStore.values())
    .filter((ticket) => ticket.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function getTicketById(ticketId: string) {
  return ticketStore.get(ticketId)
}

export function createTicket(params: {
  userId: string
  userEmail: string
  subject: string
  message: string
}) {
  const ticket: SupportTicketRecord = {
    id: createTicketId(),
    user_id: params.userId,
    user_email: params.userEmail,
    subject: params.subject,
    message: params.message,
    status: "open",
    created_at: new Date().toISOString(),
  }

  ticketStore.set(ticket.id, ticket)
  return ticket
}

export function updateTicketMessage(params: {
  ticketId: string
  message: string
  status?: SupportStatus
}) {
  const existing = ticketStore.get(params.ticketId)
  if (!existing) return null

  const updated: SupportTicketRecord = {
    ...existing,
    message: params.message,
    status: params.status ?? existing.status,
  }
  ticketStore.set(params.ticketId, updated)
  return updated
}
