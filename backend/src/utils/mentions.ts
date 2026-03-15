export function extractMentions(text: string) {
  // Accept "@email" and "@Name" tokens. For MVP, match emails only.
  const out = new Set<string>()
  const re = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.add(m[1].toLowerCase())
  return Array.from(out)
}
