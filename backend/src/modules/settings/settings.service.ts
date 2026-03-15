import { prisma } from "../../db/prisma"

export async function getSystemSettings() {
  return prisma.systemSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      retentionDays: 30,
      hideClosedTenders: true,
    },
  })
}

export async function updateSystemSettings(patch: {
  retentionDays?: number
  hideClosedTenders?: boolean
}) {
  const data: any = {}
  if (patch.retentionDays !== undefined)
    data.retentionDays = Number(patch.retentionDays)
  if (patch.hideClosedTenders !== undefined)
    data.hideClosedTenders = Boolean(patch.hideClosedTenders)

  return prisma.systemSettings.update({
    where: { id: "singleton" },
    data,
  })
}
