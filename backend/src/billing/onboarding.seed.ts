import { prisma } from "../db/prisma"

/**
 * Seed default onboarding checklist items
 * Idempotent - safe to run multiple times
 */
export async function seedOnboardingChecklist() {
  const items = [
    {
      key: "FIRST_COMPARE",
      title: "Compare tenders",
      description: "Compare requirements, deadlines, and eligibility.",
      order: 1,
    },
    {
      key: "FIRST_WORKSPACE_TASK",
      title: "Create a workspace task",
      description: "Assign a task to your team and set a due date.",
      order: 2,
    },
    {
      key: "FIRST_RISK",
      title: "Run risk scoring",
      description: "Identify compliance and timing risks early.",
      order: 3,
    },
    {
      key: "FIRST_EXPORT",
      title: "Export a bid pack",
      description: "Generate a summary export for review.",
      order: 4,
    },
  ]

  for (const it of items) {
    await prisma.onboardingChecklistItem.upsert({
      where: { key: it.key },
      create: it,
      update: {
        title: it.title,
        description: it.description,
        order: it.order,
      },
    })
  }
}
