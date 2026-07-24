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

export type SupportReplyRecord = {
  id: string
  ticket_id: string
  sender_id: string
  message: string
  created_at: string
}

export type SupportResourceRecord = {
  id: string
  title: string
  url: string
  created_at: string
}

const ticketStore = new Map<string, SupportTicketRecord>()
const replyStore = new Map<string, SupportReplyRecord[]>()
const resourceStore = new Map<string, SupportResourceRecord>()
let ticketCounter = 1
let replyCounter = 1
let resourceCounter = 1

function createTicketId() {
  const value = `local-${Date.now()}-${ticketCounter}`
  ticketCounter += 1
  return value
}

function createReplyId() {
  const value = `reply-${Date.now()}-${replyCounter}`
  replyCounter += 1
  return value
}

function createResourceId() {
  const value = `resource-${Date.now()}-${resourceCounter}`
  resourceCounter += 1
  return value
}

export function listTicketsForUser(userId: string) {
  return Array.from(ticketStore.values())
    .filter((ticket) => ticket.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function listAllTickets() {
  return Array.from(ticketStore.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function deleteTicket(ticketId: string) {
  return ticketStore.delete(ticketId)
}

export function deleteTicketsBySubject(subject: string) {
  const ids: string[] = []
  for (const [id, ticket] of ticketStore.entries()) {
    if (ticket.subject === subject) ids.push(id)
  }
  ids.forEach((id) => ticketStore.delete(id))
  return ids.length
}

export function deleteAllTickets() {
  const count = ticketStore.size
  ticketStore.clear()
  return count
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

export function listRepliesForTicket(ticketId: string) {
  return (replyStore.get(ticketId) || []).slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export function createReply(params: {
  ticketId: string
  senderId: string
  message: string
}) {
  const reply: SupportReplyRecord = {
    id: createReplyId(),
    ticket_id: params.ticketId,
    sender_id: params.senderId,
    message: params.message,
    created_at: new Date().toISOString(),
  }

  const existing = replyStore.get(params.ticketId) || []
  const next = [...existing, reply]
  replyStore.set(params.ticketId, next)
  return reply
}

export function listResources() {
  return Array.from(resourceStore.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function createResource(params: { title: string; url: string }) {
  const resource: SupportResourceRecord = {
    id: createResourceId(),
    title: params.title,
    url: params.url,
    created_at: new Date().toISOString(),
  }

  resourceStore.set(resource.id, resource)
  return resource
}

export function deleteResource(resourceId: string) {
  return resourceStore.delete(resourceId)
}
