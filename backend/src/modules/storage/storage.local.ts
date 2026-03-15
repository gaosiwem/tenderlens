import fs from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import crypto from "crypto"
import { env } from "../../config/env"
import type { StorageDriver, StoredObject } from "./storage.types"

function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex")
}

function resolveLocalStorageRoot(configuredPath: string) {
  const backendRoot = path.resolve(__dirname, "../../../..")

  if (path.isAbsolute(configuredPath)) {
    // Docker commonly injects /app/storage. If that leaks into a local
    // Windows process, remap it back to the backend project storage folder.
    if (
      process.platform === "win32" &&
      /^[\\/]+app([\\/]+|$)/i.test(configuredPath)
    ) {
      const suffix = configuredPath
        .replace(/^[\\/]+app([\\/]+|$)/i, "")
        .replace(/^[\\/]+/, "")
      return path.resolve(backendRoot, suffix || "storage")
    }

    return configuredPath
  }

  // Resolve relative paths from the backend project root instead of cwd so
  // API, worker, source, dist, and container entrypoints all agree.
  if (existsSync(path.join(backendRoot, "package.json"))) {
    return path.resolve(backendRoot, configuredPath)
  }

  return path.resolve(process.cwd(), configuredPath)
}

export class LocalStorageDriver implements StorageDriver {
  private root = resolveLocalStorageRoot(env.LOCAL_STORAGE_PATH)

  async putObject(args: {
    key: string
    body: Buffer
    mimeType: string
  }): Promise<StoredObject> {
    const full = path.join(this.root, args.key)
    await fs.mkdir(this.root, { recursive: true })
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, args.body)

    return {
      key: args.key,
      sizeBytes: args.body.length,
      checksumSha256: sha256(args.body),
      mimeType: args.mimeType,
    }
  }

  async getObject(args: { key: string }): Promise<Buffer> {
    const full = path.join(this.root, args.key)
    return fs.readFile(full)
  }

  async deleteObject(args: { key: string }): Promise<void> {
    const full = path.join(this.root, args.key)
    try {
      await fs.unlink(full)
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : ""
      if (code === "ENOENT") return
      throw error
    }
  }
}
