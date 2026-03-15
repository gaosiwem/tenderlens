import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import type { Conversation } from "@/lib/chat.types";
import { TLButton } from "@/components/tenderlens/button";

export function TLConversationCard(props: { c: Conversation }) {
  const title = props.c.title || "Untitled conversation";
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="font-display text-sm font-extrabold truncate">
              {props.c.tenderId ? (
                <Link
                  href={`/tenders/${props.c.tenderId}`}
                  className="hover:text-primary transition-colors"
                >
                  {title}
                </Link>
              ) : (
                title
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <TLCodeBadge
                value={`updated ${new Date(props.c.updatedAt).toLocaleString()}`}
              />
            </div>
          </div>
          <Link href={`/chat/${props.c.id}`}>
            <TLButton>Open</TLButton>
          </Link>
        </div>

        <div className="text-sm text-muted-foreground">
          {props.c.tenderId
            ? "Scoped to a specific tender."
            : "Searches across all tenders in the organization."}
        </div>
      </CardContent>
    </Card>
  );
}
