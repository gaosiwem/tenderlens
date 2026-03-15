export function isWithinQuietHours(
  start: string | null,
  end: string | null,
  now = new Date(),
) {
  if (!start || !end) return false

  const [sH, sM] = start.split(":").map(Number)
  const [eH, eM] = end.split(":").map(Number)
  const currentH = now.getHours()
  const currentM = now.getMinutes()

  const startTotal = sH * 60 + sM
  const endTotal = eH * 60 + eM
  const currentTotal = currentH * 60 + currentM

  if (startTotal < endTotal) {
    return currentTotal >= startTotal && currentTotal < endTotal
  } else {
    // Over midnight e.g. 22:00 to 06:00
    return currentTotal >= startTotal || currentTotal < endTotal
  }
}

export function getNextQuietHoursEnd(end: string, now = new Date()) {
  const [eH, eM] = end.split(":").map(Number)
  const next = new Date(now)
  next.setHours(eH, eM, 0, 0)
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }
  return next
}
