import { z } from "zod"

export const registerSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120).optional()
})

export const loginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1).max(200)
})

export const requestResetSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim())
})

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
})

export const resendVerificationSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
})

export const googleLoginSchema = z.object({
  credential: z.string().min(20),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(200)
})
