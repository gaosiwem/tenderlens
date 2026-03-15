"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText, Trash2, Upload } from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteOrgBusinessDoc,
  listOrgBusinessDocs,
  uploadOrgBusinessDoc,
} from "@/lib/org-docs.api";
import type { OrgBusinessDocFile } from "@/lib/org-docs.types";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusLabel(status: OrgBusinessDocFile["status"]) {
  if (status === "queued") return "Queued";
  if (status === "processing") return "Processing";
  if (status === "ready") return "Ready";
  if (status === "failed") return "Failed";
  return "Unknown";
}

function statusBadgeClass(status: OrgBusinessDocFile["status"]) {
  if (status === "ready") return "bg-emerald-500/15 text-emerald-700";
  if (status === "processing" || status === "queued")
    return "bg-blue-500/15 text-blue-700";
  if (status === "failed") return "bg-red-500/15 text-red-700";
  return "bg-muted text-muted-foreground";
}

export default function OrgDocsPage() {
  const [items, setItems] = React.useState<OrgBusinessDocFile[]>([]);
  const [ready, setReady] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deletingFileId, setDeletingFileId] = React.useState<string | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] =
    React.useState<OrgBusinessDocFile | null>(null);
  const [file, setFile] = React.useState<File | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await listOrgBusinessDocs();
    setLoading(false);
    if (!res.ok) {
      toast.error("Failed to load business documents", {
        description: res.error.message,
      });
      return;
    }
    setItems(res.data.items);
    setReady(res.data.ready);
    setProcessing(res.data.processing);
  }, []);

  async function upload() {
    if (!file || uploading) return;
    setUploading(true);
    const res = await uploadOrgBusinessDoc(file);
    setUploading(false);
    if (!res.ok) {
      toast.error("Upload failed", { description: res.error.message });
      return;
    }

    toast.success("Business document uploaded", {
      description:
        "We are extracting it now. Eligibility checks will use this context once processing finishes.",
    });
    setFile(null);
    await load();
  }

  async function removeDocument() {
    const doc = pendingDeleteDoc;
    if (!doc || deletingFileId) return;

    setDeletingFileId(doc.id);
    const res = await deleteOrgBusinessDoc(doc.id);
    setDeletingFileId(null);
    if (!res.ok) {
      toast.error("Delete failed", { description: res.error.message });
      return;
    }

    toast.success("Document deleted");
    setPendingDeleteDoc(null);
    await load();
  }

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      void load();
    }, 2500);
    return () => clearInterval(timer);
  }, [processing, load]);

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Settings">
      <TLSection
        title="Organization Business Documents"
        description="Upload company profile documents (certifications, registration, capability statements) used to assess tender eligibility."
        right={
          <TLButton
            variant="secondary"
            onClick={load}
            disabled={loading || uploading}
          >
            Refresh
          </TLButton>
        }
      >
        <div className="space-y-4">
          {processing ? (
            <TLInlineAlert variant="info" title="Processing documents">
              Your uploaded business documents are being extracted.
              Eligibility checks will improve when processing completes.
            </TLInlineAlert>
          ) : ready ? (
            <TLInlineAlert
              variant="success"
              title="Eligibility context ready"
            >
              AI compare and checklist can use your organization profile
              documents to check if you are eligible to apply.
            </TLInlineAlert>
          ) : (
            <TLInlineAlert
              variant="warning"
              title="No eligibility context yet"
            >
              Upload at least one organization business document so the system
              can evaluate whether you are eligible for tenders.
            </TLInlineAlert>
          )}

          <div className="rounded-xl border border-border p-4 space-y-3 bg-background/40">
            <div className="text-sm font-semibold">Upload document</div>
            <label
              htmlFor="org-doc-upload"
              className="flex flex-col items-center justify-center gap-3 px-6 py-10 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all cursor-pointer"
            >
              <Upload className="size-8 text-primary/60" />
              {file ? (
                <div className="text-sm font-medium text-foreground text-center">
                  {file.name}{" "}
                  <span className="text-muted-foreground">
                    ({formatSize(file.size)})
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-sm font-medium text-foreground">
                    Click here to select a document
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Supported formats: PDF, DOCX, TXT
                  </div>
                </>
              )}
            </label>
            <input
              id="org-doc-upload"
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <TLButton
              onClick={upload}
              disabled={!file || uploading}
              leftIcon={<Upload className="size-4" />}
            >
              {uploading ? "Uploading..." : "Upload Business Document"}
            </TLButton>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold border-b bg-muted/30">
              Uploaded documents
            </div>
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No business documents uploaded yet.
              </div>
            ) : (
              <div className="divide-y">
                {items.map((doc) => (
                  <div
                    key={doc.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        {doc.originalFilename}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatSize(doc.sizeBytes)} - {doc.mimeType}
                      </div>
                      {doc.status === "failed" && doc.statusMessage ? (
                        <div className="text-xs text-red-600 truncate max-w-[40ch]">
                          {doc.statusMessage}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(doc.status)}`}
                      >
                        {statusLabel(doc.status)}
                      </span>
                        <div className="text-xs text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </div>
                        <TLButton
                          variant="outline"
                          size="sm"
                          disabled={
                            deletingFileId === doc.id ||
                            uploading ||
                            doc.status === "processing" ||
                            doc.status === "queued"
                          }
                          onClick={() => {
                            setPendingDeleteDoc(doc);
                          }}
                          leftIcon={<Trash2 className="size-3.5" />}
                        >
                          {deletingFileId === doc.id ? "Deleting..." : "Delete"}
                        </TLButton>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        <Dialog
          open={!!pendingDeleteDoc}
          onOpenChange={(open) => {
            if (!open && !deletingFileId) setPendingDeleteDoc(null);
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="font-display">Delete document</DialogTitle>
              <DialogDescription>
                This will permanently delete{" "}
                <span className="font-semibold text-foreground">
                  {pendingDeleteDoc?.originalFilename}
                </span>
                . This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <TLButton
                variant="secondary"
                disabled={!!deletingFileId}
                onClick={() => setPendingDeleteDoc(null)}
              >
                Cancel
              </TLButton>
              <TLButton
                variant="destructive"
                disabled={!!deletingFileId}
                leftIcon={<Trash2 className="size-3.5" />}
                onClick={() => {
                  void removeDocument();
                }}
              >
                {deletingFileId ? "Deleting..." : "Delete"}
              </TLButton>
            </div>
          </DialogContent>
        </Dialog>
      </TLSection>
    </TenderLensAppShell>
  );
}
