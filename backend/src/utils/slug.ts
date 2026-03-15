export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}