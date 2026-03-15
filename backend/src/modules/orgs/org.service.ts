import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import { slugify } from "../../utils/slug"
import { Role } from "@prisma/client"
import { refreshSeatsUsed } from "../../billing/seats.service"

export async function listUserOrgs(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { org: true },
  })

  return memberships.map((m) => ({
    org: m.org,
    role: m.role,
  }))
}

export async function createOrg(userId: string, name: string) {
  const base = slugify(name)
  let slug = base || `org-${Date.now()}`
  let i = 1

  while (true) {
    const exists = await prisma.organization.findUnique({ where: { slug } })
    if (!exists) break
    i += 1
    slug = `${base}-${i}`
  }

  const org = await prisma.organization.create({
    data: { name, slug },
  })

  await prisma.membership.create({
    data: { userId, orgId: org.id, role: Role.OWNER },
  })

  // Revenue Sprint 1: Initialize subscription with 14-day trial
  await prisma.orgSubscription.create({
    data: {
      orgId: org.id,
      plan: "TRIAL" as any,
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      seatsUsed: 1,
    },
  })

  return org
}

export async function getOrg(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) throw new AppError("NOT_FOUND", "Organization not found", 404)
  return org
}

export async function listMembers(orgId: string) {
  const members = await prisma.membership.findMany({
    where: { orgId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  })

  return members.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    createdAt: m.createdAt,
  }))
}

export async function addMember(orgId: string, email: string, role: Role) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user)
    throw new AppError("NOT_FOUND", "User not found. Register first.", 404)

  const existing = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: user.id, orgId } },
  })
  if (existing) throw new AppError("CONFLICT", "User is already a member", 409)

  const membership = await prisma.membership.create({
    data: { userId: user.id, orgId, role },
  })

  await refreshSeatsUsed(orgId)

  return membership
}

export async function updateMemberRole(
  orgId: string,
  membershipId: string,
  role: Role,
) {
  const m = await prisma.membership.findUnique({ where: { id: membershipId } })
  if (!m || m.orgId !== orgId)
    throw new AppError("NOT_FOUND", "Membership not found", 404)

  return prisma.membership.update({
    where: { id: membershipId },
    data: { role },
  })
}

export async function removeMember(orgId: string, membershipId: string) {
  const m = await prisma.membership.findUnique({ where: { id: membershipId } })
  if (!m || m.orgId !== orgId)
    throw new AppError("NOT_FOUND", "Membership not found", 404)
  const deleted = await prisma.membership.delete({ where: { id: membershipId } })
  await refreshSeatsUsed(orgId)
  return deleted
}
