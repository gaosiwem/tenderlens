import { z } from "zod"
import { Role } from "@prisma/client"

export const createOrgSchema = z.object({
  name: z.string().min(2).max(120)
})

export const addMemberSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  role: z.nativeEnum(Role).optional()
})

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(Role)
})