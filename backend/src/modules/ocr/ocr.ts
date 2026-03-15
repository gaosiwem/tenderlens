import { env } from "../../config/env"
import Tesseract from "tesseract.js"
import { fromBuffer } from "pdf2pic"
import sharp from "sharp"

export async function ocrImageBuffer(buf: Buffer): Promise<string> {
  const normalized = await sharp(buf).rotate().toBuffer()
  const out = await Tesseract.recognize(normalized, env.OCR_LANG, {
    logger: () => undefined,
  })
  return (out.data.text ?? "").trim()
}

export async function ocrPdfBuffer(
  buf: Buffer,
): Promise<{ text: string; pages: number }> {
  const converter = fromBuffer(buf, {
    density: 220,
    format: "png",
    width: 1654,
    height: 2339,
    savePath: "/tmp",
  })

  const texts: string[] = []
  let pages = 0

  for (let i = 1; i <= 25; i += 1) {
    try {
      const out = await converter(i)
      if (!out?.path) break
      pages += 1
      const imgBuf = await sharp(out.path).toBuffer()
      const t = await ocrImageBuffer(imgBuf)
      if (t) texts.push(t)
    } catch {
      break
    }
  }

  return { text: texts.join("\n\n"), pages }
}
