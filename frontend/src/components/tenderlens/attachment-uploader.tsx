"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { uploadWorkspaceAttachment } from "@/lib/attachments.api";
import type { BidAttachment } from "@/lib/workspace.types";

export function TLAttachmentUploader(props: {
  workspaceId: string;
  onUploaded: () => Promise<void>;
  attachments: BidAttachment[];
}) {
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  async function onPickFile(f: File) {
    setUploading(true);
    const res = await uploadWorkspaceAttachment(props.workspaceId, f);
    setUploading(false);

    if (!res.ok) {
      toast.error("Upload failed", { description: res.error.message });
      return;
    }
    toast.success("Uploaded");
    await props.onUploaded();
  }

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-display text-sm font-extrabold">
              Attachments
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Upload bid documents, quotations, letters.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
              }}
            />
            <TLButton
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </TLButton>
          </div>
        </div>

        <div className="grid gap-2">
          {props.attachments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No files yet.</div>
          ) : null}

          {props.attachments.slice(0, 25).map((a) => (
            <div
              key={a.id}
              className="border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div>
                <div className="text-sm font-semibold">{a.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {a.mimeType} . {Math.round(a.sizeBytes / 1024)} KB
                </div>
              </div>
              {a.url ? (
                <a
                  className="text-sm underline"
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              ) : (
                <div className="text-xs text-muted-foreground">No url</div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
