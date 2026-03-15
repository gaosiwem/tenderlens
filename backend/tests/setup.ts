import { beforeAll, afterAll } from "vitest"
import { prisma } from "../src/db/prisma"

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})