export type StoredObject = {
  key: string
  sizeBytes: number
  checksumSha256: string
  mimeType: string
}

export interface StorageDriver {
  putObject(args: {
    key: string
    body: Buffer
    mimeType: string
  }): Promise<StoredObject>
  getObject(args: { key: string }): Promise<Buffer>
  deleteObject(args: { key: string }): Promise<void>
}
