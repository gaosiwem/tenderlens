import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import { env } from "../../config/env"
import crypto from "crypto"
import type { StorageDriver, StoredObject } from "./storage.types"

function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex")
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export class S3StorageDriver implements StorageDriver {
  private s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  })

  async putObject(args: {
    key: string
    body: Buffer
    mimeType: string
  }): Promise<StoredObject> {
    if (!env.S3_BUCKET) throw new Error("S3_BUCKET missing")

    await this.s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: args.key,
        Body: args.body,
        ContentType: args.mimeType,
      }),
    )

    return {
      key: args.key,
      sizeBytes: args.body.length,
      checksumSha256: sha256(args.body),
      mimeType: args.mimeType,
    }
  }

  async getObject(args: { key: string }): Promise<Buffer> {
    if (!env.S3_BUCKET) throw new Error("S3_BUCKET missing")
    const out = await this.s3.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: args.key }),
    )
    if (!out.Body) throw new Error("S3 object body missing")
    return streamToBuffer(out.Body)
  }

  async deleteObject(args: { key: string }): Promise<void> {
    if (!env.S3_BUCKET) throw new Error("S3_BUCKET missing")
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: args.key }),
      )
    } catch (error) {
      if (
        error instanceof S3ServiceException &&
        (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404)
      ) {
        return
      }
      throw error
    }
  }
}
