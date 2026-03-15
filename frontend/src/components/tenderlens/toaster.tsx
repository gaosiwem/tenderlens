"use client";

import { Toaster } from "sonner";

export function TenderLensToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "bg-card text-card-foreground border border-border shadow rounded-xl",
          description: "text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground hover:opacity-90 rounded-lg",
          cancelButton:
            "bg-secondary text-secondary-foreground hover:opacity-90 rounded-lg",
        },
      }}
    />
  );
}
