import { Router } from "express"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import PDFDocument from "pdfkit"
import ExcelJS from "exceljs"
import { calculateRiskScore } from "../risk/risk.service"
import { requirePlanFeature, enforceTrial } from "../../billing/plan.middleware"
import { incrementUsage } from "../../billing/usage.service"

export const exportRouter = Router()

// ... Existing single-message export ...
exportRouter.get(
  "/chat/:messageId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "exports")
      await incrementUsage(req.orgId!, "exports")

      const msg = await prisma.message.findFirst({
        where: {
          id: req.params.messageId,
          orgId: req.orgId!,
          role: "assistant",
        },
        include: {
          org: true,
        },
      })

      if (!msg) throw new AppError("NOT_FOUND", "Message not found", 404)

      const doc = new PDFDocument()
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=answer-${msg.id}.pdf`,
      )

      doc.pipe(res)

      doc.fontSize(20).text("TenderLens Answer Export", { align: "center" })
      doc.moveDown()
      doc.fontSize(12).text(`Organization: ${msg.org.name}`)
      doc.text(`Date: ${msg.createdAt.toLocaleString()}`)
      doc.moveDown()
      doc.fontSize(14).text("Answer:")
      doc.moveDown()
      doc.fontSize(12).text(msg.content)

      if (msg.citations) {
        doc.moveDown()
        doc.fontSize(14).text("Citations:")
        doc.moveDown()
        const citations = msg.citations as any[]
        citations.forEach((c, i) => {
          doc
            .fontSize(10)
            .text(
              `[${i + 1}] Tender: ${c.tenderId} | Score: ${c.score.toFixed(4)}`,
            )
        })
      }

      doc.end()
    } catch (e) {
      next(e)
    }
  },
)

// Conversation-level PDF export (all messages)
exportRouter.get(
  "/chat/conversation/:conversationId",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "exports")
      await incrementUsage(req.orgId!, "exports")

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: req.params.conversationId,
          orgId: req.orgId!,
        },
      })

      if (!conversation)
        throw new AppError("NOT_FOUND", "Conversation not found", 404)

      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversation.id,
          orgId: req.orgId!,
        },
        orderBy: { createdAt: "asc" },
      })

      const doc = new PDFDocument()
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=conversation-${conversation.id.slice(0, 8)}.pdf`,
      )

      doc.pipe(res)

      doc
        .fontSize(20)
        .text("TenderLens Conversation Export", { align: "center" })
      doc.moveDown()
      doc.fontSize(12).text(`Conversation: ${conversation.title || "Untitled"}`)
      doc.text(`Date: ${conversation.createdAt.toLocaleString()}`)
      doc.moveDown()

      doc
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke()
      doc.moveDown()

      for (const msg of messages) {
        const label = msg.role === "user" ? "You" : "TenderLens AI"
        doc.fontSize(11).fillColor("#666666").text(label)
        doc.fontSize(12).fillColor("#000000").text(msg.content)
        doc.moveDown(0.5)

        doc
          .moveTo(doc.x, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor("#e0e0e0")
          .stroke()
        doc.moveDown(0.5)
      }

      doc.end()
    } catch (e) {
      console.error("Conversation PDF Export Error:", e)
      next(e)
    }
  },
)

// PDF Workspace Export
exportRouter.get(
  "/workspace/:tenderId/pdf",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "exports")
      await incrementUsage(req.orgId!, "exports")

      const tenderId = req.params.tenderId
      const orgId = req.orgId!

      const workspace = await prisma.bidWorkspace.findFirst({
        where: { tenderId, orgId },
        include: {
          tender: {
            include: {
              deadlines: true,
            },
          },
          tasks: { include: { owner: true } },
          attachments: true,
        },
      })

      if (!workspace) {
        throw new AppError("NOT_FOUND", "Workspace not found", 404)
      }

      const risk = await calculateRiskScore({ orgId, tenderId })

      const doc = new PDFDocument()
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=workspace-${tenderId}.pdf`,
      )
      doc.pipe(res)

      doc.fontSize(24).text("Bid Workspace Report", { align: "center" })
      doc
        .fontSize(12)
        .text(`Tender: ${workspace.tender.title}`, { align: "center" })
      doc.moveDown()

      doc.fontSize(16).text("Risk Assessment")
      doc.fontSize(14).text(`Score: ${risk.score} / 100 (${risk.level})`)
      doc.fontSize(10).text(`Signals: ${risk.signals.join(", ")}`)
      doc.moveDown()

      doc.fontSize(16).text("Tasks")
      const tasks = workspace.tasks
      if (tasks.length === 0) {
        doc.fontSize(12).text("No tasks scheduled.")
      } else {
        tasks.forEach((t) => {
          doc
            .fontSize(12)
            .text(`[${t.status}] ${t.title} - Priority: ${t.priority}`)
          if (t.owner)
            doc
              .fontSize(10)
              .text(`   Assigned to: ${t.owner.name || t.owner.email}`)
          if (t.dueAt)
            doc.fontSize(10).text(`   Due: ${t.dueAt.toLocaleDateString()}`)
        })
      }

      doc.moveDown()
      doc.fontSize(16).text("Attachments")
      const attachments = workspace.attachments
      if (attachments.length === 0) {
        doc.fontSize(12).text("No attachments.")
      } else {
        attachments.forEach((a) => {
          doc
            .fontSize(12)
            .text(`${a.filename} (${(a.sizeBytes / 1024).toFixed(1)} KB)`)
        })
      }

      doc.end()
    } catch (e) {
      console.error("PDF Export Error:", e)
      next(e)
    }
  },
)

// Excel Workspace Export
exportRouter.get(
  "/workspace/:tenderId/xlsx",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "exports")
      await incrementUsage(req.orgId!, "exports")

      const tenderId = req.params.tenderId
      const orgId = req.orgId!

      const workspace = await prisma.bidWorkspace.findFirst({
        where: { tenderId, orgId },
        include: {
          tasks: { include: { owner: true } },
        },
      })

      if (!workspace) {
        throw new AppError("NOT_FOUND", "Workspace not found", 404)
      }

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Bid Tasks")

      sheet.columns = [
        { header: "Task ID", key: "id", width: 15 },
        { header: "Title", key: "title", width: 30 },
        { header: "Status", key: "status", width: 15 },
        { header: "Priority", key: "priority", width: 15 },
        { header: "Assignee", key: "assignee", width: 25 },
        { header: "Due Date", key: "dueAt", width: 20 },
      ]

      workspace.tasks.forEach((t) => {
        sheet.addRow({
          id: t.id.slice(0, 8),
          title: t.title,
          status: t.status,
          priority: t.priority,
          assignee: t.owner?.name || t.owner?.email || "Unassigned",
          dueAt: t.dueAt ? t.dueAt.toLocaleDateString() : "N/A",
        })
      })

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=workspace-${tenderId}.xlsx`,
      )

      await workbook.xlsx.write(res)
      res.end()
    } catch (e) {
      console.error("XLSX Export Error:", e)
      next(e)
    }
  },
)
