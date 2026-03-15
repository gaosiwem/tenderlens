import { prisma } from "../src/db/prisma"
import { hashPassword } from "../src/utils/crypto"

async function main() {
  const adminEmail = "owner@example.com"
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  const seedPassword = "seed-only-change-me"
  const seedPasswordHash = await hashPassword(seedPassword)

  if (existing) {
    if (existing.passwordHash === seedPassword) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: seedPasswordHash }
      })
      console.log("Seed user password upgraded to Argon2 hash")
      return
    }

    console.log("Seed already applied")
    return
  }

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: seedPasswordHash,
      name: "Seed Owner"
    }
  })

  console.log("Seed complete")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
