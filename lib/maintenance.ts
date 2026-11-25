export const MAINTENANCE_REOPEN_AT = "2026-11-25T19:00:00.000Z"
export const MAINTENANCE_REOPEN_LABEL = "2:00 PM Toronto time on November 25, 2026"

export function isMaintenanceActive(now = Date.now()) {
  return now < Date.parse(MAINTENANCE_REOPEN_AT)
}
