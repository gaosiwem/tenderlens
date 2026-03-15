import { prisma } from "../../db/prisma"

export async function logTenderChange(args: {
  orgId: string
  tenderId: string
  type:
    | "FILE_HASH_CHANGED"
    | "CHUNKS_CHANGED"
    | "DEADLINE_CHANGED"
    | "SUMMARY_CHANGED"
    | "LIFECYCLE_CHANGED"
  meta?: any
}) {
  return prisma.tenderChangeLog.create({
    data: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      type: args.type as any,
      meta: args.meta ?? null,
    },
  })
}
