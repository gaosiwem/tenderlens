import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "./button";
import { TLCodeBadge } from "./code-badge";

export function TLResultCard(props: {
  tenderId: string;
  title?: string;
  fileId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="font-display text-base font-extrabold truncate">
              {props.title ?? "Tender"}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/tenders/${props.tenderId}`}>
              <TLButton variant="secondary">Open</TLButton>
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/30 p-4 text-sm text-muted-foreground leading-6">
          {props.snippet}
        </div>
      </CardContent>
    </Card>
  );
}
