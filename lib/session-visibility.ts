const MEMBER_LEVELS = new Set(["bronze", "silver", "gold", "diamond", "member"])

export function getMemberLevel(role: string | null | undefined, level: string | null | undefined) {
  const normalizedRole = role?.trim().toLowerCase()
  if (normalizedRole === "member") return level?.trim() || null
  return normalizedRole && MEMBER_LEVELS.has(normalizedRole) ? normalizedRole : null
}

export function isSessionVisibleToLevel(
  visibilityTiers: string[] | null | undefined,
  level: string | null | undefined,
) {
  if (!Array.isArray(visibilityTiers)) return true

  const normalizedLevel = level?.trim().toLowerCase()
  return Boolean(
    normalizedLevel &&
      visibilityTiers.some((tier) => typeof tier === "string" && tier.trim().toLowerCase() === normalizedLevel),
  )
}
