import Link from "next/link";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import type { Citation } from "@/lib/chat.types";

export function TLCitationList(props: { items: Citation[] }) {
  if (!props.items?.length) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground ">
        Citations
      </div>
      <div className="flex flex-col gap-2">
        {props.items.map((c) => (
          <div key={c.chunkId} className="flex flex-wrap items-center gap-2">
            <TLCodeBadge value={`chunk ${c.chunkId.slice(0, 8)}`} />
            <TLCodeBadge value={`idx ${c.index}`} />
            <TLCodeBadge value={`score ${c.score.toFixed(3)}`} />
            <Link
              href={`/tenders/${c.tenderId}/chunks?q=${encodeURIComponent(String(c.index))}`}
              className="text-sm underline text-foreground/90"
            >
              Open chunks
            </Link>
            <Link
              href={`/tenders/${c.tenderId}`}
              className="text-sm underline text-foreground/90"
            >
              Open tender
            </Link>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        Answers are generated from retrieved chunks only. If a requirement is
        missing from citations, treat it as not verified.
      </div>
    </div>
  );
}
