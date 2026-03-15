import { env } from "../../config/env"
import type { StorageDriver } from "./storage.types"
import { LocalStorageDriver } from "./storage.local"
import { S3StorageDriver } from "./storage.s3"

let driver: StorageDriver | null = null

export function storage(): StorageDriver {
  if (driver) return driver
  driver =
    env.STORAGE_DRIVER === "s3"
      ? new S3StorageDriver()
      : new LocalStorageDriver()
  return driver
}
