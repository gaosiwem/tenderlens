import path from "path"
import { AppError } from "./responses"

type UploadedFileLike = {
  originalname?: string
  mimetype?: string
  buffer?: Buffer
}

const canonicalExtensions: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "text/plain": [".txt"],
}

function normalizeMimeType(input?: string) {
  return String(input ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase()
}

function startsWithBytes(buffer: Buffer, bytes: number[]) {
  if (buffer.length < bytes.length) return false
  return bytes.every((value, index) => buffer[index] === value)
}

function looksLikeUtf8Text(buffer: Buffer) {
  if (buffer.length === 0) return true
  if (buffer.includes(0)) return false

  let suspicious = 0
  for (const byte of buffer) {
    const isAsciiControl =
      byte < 32 && byte !== 9 && byte !== 10 && byte !== 13
    if (isAsciiControl) suspicious += 1
  }

  return suspicious / buffer.length < 0.02
}

function detectMimeType(buffer: Buffer, extension: string) {
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf"
  }

  if (
    startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png"
  }

  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg"
  }

  const isZipContainer =
    startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08])

  if (isZipContainer) {
    if (extension === ".docx") {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
    if (extension === ".xlsx") {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    return null
  }

  if (looksLikeUtf8Text(buffer)) {
    return "text/plain"
  }

  return null
}

function isDeclaredMimeCompatible(args: {
  declaredMimeType: string
  detectedMimeType: string
}) {
  const declared = normalizeMimeType(args.declaredMimeType)
  if (!declared || declared === args.detectedMimeType) return true
  if (declared === "application/octet-stream") return true
  if (
    declared === "application/zip" &&
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].includes(args.detectedMimeType)
  ) {
    return true
  }
  if (declared === "image/pjpeg" && args.detectedMimeType === "image/jpeg") {
    return true
  }
  return false
}

export function parseAllowedMimeTypes(raw: string | undefined) {
  return new Set(
    String(raw ?? "")
      .split(",")
      .map((value) => normalizeMimeType(value))
      .filter(Boolean),
  )
}

export function validateUploadedFile(args: {
  file: UploadedFileLike | null | undefined
  allowedMimeTypes: Iterable<string>
  fileLabel?: string
}) {
  const file = args.file
  const label = args.fileLabel ?? "File"

  if (!file?.buffer) {
    throw new AppError("VALIDATION_ERROR", `${label} content is missing`, 400)
  }

  const originalname = String(file.originalname ?? "").trim() || "upload"
  const extension = path.extname(originalname).toLowerCase()
  const detectedMimeType = detectMimeType(file.buffer, extension)
  if (!detectedMimeType) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${label} content could not be verified`,
      400,
    )
  }

  const allowedMimeTypes = new Set(
    [...args.allowedMimeTypes].map((value) => normalizeMimeType(value)),
  )
  if (!allowedMimeTypes.has(detectedMimeType)) {
    throw new AppError("VALIDATION_ERROR", `${label} type not allowed`, 400)
  }

  const allowedExtensions = canonicalExtensions[detectedMimeType] ?? []
  if (
    extension &&
    allowedExtensions.length > 0 &&
    !allowedExtensions.includes(extension)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${label} extension does not match its content`,
      400,
    )
  }

  if (
    !isDeclaredMimeCompatible({
      declaredMimeType: String(file.mimetype ?? ""),
      detectedMimeType,
    })
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${label} content does not match its declared type`,
      400,
    )
  }

  return {
    extension,
    mimeType: detectedMimeType,
    safeName: originalname.replace(/[^\w.\-]+/g, "_"),
  }
}
