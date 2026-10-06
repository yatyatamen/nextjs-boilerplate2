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
