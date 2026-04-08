"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { TLButton } from "@/components/tenderlens/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="tl-surface max-w-md space-y-4 p-6 text-center">
            <div className="font-display text-2xl font-extrabold">
              Something went wrong
            </div>
            <p className="text-sm text-muted-foreground">
              We hit an unexpected error and captured it for review.
            </p>
            <div className="flex justify-center">
              <TLButton onClick={reset}>Try again</TLButton>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
