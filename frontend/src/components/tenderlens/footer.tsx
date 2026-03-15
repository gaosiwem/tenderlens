import Link from "next/link";
import { cn } from "@/lib/utils";

export function TenderLensFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-10 pb-8", className)}>
      <div className="mx-auto max-w-[1320px] px-4">
        <div className="tl-surface px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} TenderLens
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <Link
                className="text-muted-foreground hover:text-foreground"
                href="/support"
              >
                Support
              </Link>
              <Link
                className="text-muted-foreground hover:text-foreground"
                href="/privacy"
              >
                Privacy
              </Link>
              <Link
                className="text-muted-foreground hover:text-foreground"
                href="/terms"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
