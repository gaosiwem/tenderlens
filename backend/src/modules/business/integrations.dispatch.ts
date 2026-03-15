import { prisma } from "../../db/prisma"
import { logger } from "../../utils/logger"

export async function dispatchIntegrationWebhooks(args: {
  orgId: string
  event: {
    id: string
    type: string
    entityType: string | null
    entityId: string | null
    meta: unknown
    createdAt: Date
  }
}) {
  const endpoints = await prisma.orgIntegrationEndpoint.findMany({
    where: {
      orgId: args.orgId,
      isEnabled: true,
      OR: [
        { subscribedEvents: { isEmpty: true } },
        { subscribedEvents: { has: args.event.type } },
      ],
    },
  })

  if (!endpoints.length) return { sent: 0 }

  let sent = 0
  await Promise.all(
    endpoints.map(async (endpoint) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-tenderlens-event": args.event.type,
      }

      if (endpoint.authType === "bearer" && endpoint.authToken) {
        headers.authorization = `Bearer ${endpoint.authToken}`
      }

      try {
        const response = await fetch(endpoint.endpointUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: args.event.id,
            type: args.event.type,
            entityType: args.event.entityType,
            entityId: args.event.entityId,
            meta: args.event.meta,
            createdAt: args.event.createdAt.toISOString(),
          }),
          signal: AbortSignal.timeout(8000),
        })

        if (!response.ok) {
          logger.warn(
            {
              orgId: args.orgId,
              endpointId: endpoint.id,
              status: response.status,
              eventId: args.event.id,
            },
            "integration_webhook_failed",
          )
          return
        }

        await prisma.orgIntegrationEndpoint.update({
          where: { id: endpoint.id },
          data: { lastDeliveredAt: new Date() },
        })
        sent++
      } catch (error) {
        logger.warn(
          {
            orgId: args.orgId,
            endpointId: endpoint.id,
            eventId: args.event.id,
            err: error,
          },
          "integration_webhook_error",
        )
      }
    }),
  )

  return { sent }
}
