"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { TLButton } from "@/components/tenderlens/button";
import { exportAnswerPdf } from "@/lib/export.api";

export function TLMessageActions(props: { messageId: string }) {
  const [loading, setLoading] = React.useState(false);

  async function onExport() {
    setLoading(true);
    const res = await exportAnswerPdf(props.messageId);
    setLoading(false);

    if (!res.ok) {
      toast.error("Export failed", { description: res.error });
      return;
    }

    const a = document.createElement("a");
    a.href = res.url;
    a.download = `tenderlens-answer-${props.messageId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(res.url), 1000);

    toast.success("Downloaded PDF");
  }

  return (
    <TLButton
      variant="secondary"
      size="sm"
      onClick={onExport}
      disabled={loading}
      iconLeft={<Download className="h-4 w-4" />}
    >
      {loading ? "Exporting..." : "Export PDF"}
    </TLButton>
  );
}
