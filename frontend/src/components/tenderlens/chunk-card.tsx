import { Card, CardContent } from "@/components/ui/card";
import { TLCodeBadge } from "./code-badge";

export function TLChunkCard(props: {
  fileId: string;
  index: number;
  createdAt: string;
  content: string;
  highlight?: string;
}) {
  const c = props.content;
  const hl = props.highlight?.trim();
  const render = !hl ? c : c.replaceAll(hl, `<<HIGHLIGHT>>${hl}<<END>>`);

  return (
    <Card className="tl-surface">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <div className="font-display text-sm font-extrabold">
            Section {props.index}
          </div>
          <TLCodeBadge value={`file ${props.fileId.slice(0, 8)}`} />
          <TLCodeBadge value={new Date(props.createdAt).toLocaleString()} />
        </div>
        <div className="tl-divider" />
        <div className="p-5">
          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background/30 p-4 text-sm leading-6">
            {render.split("<<HIGHLIGHT>>").flatMap((part, i) => {
              if (i === 0) return [part];
              const [hit, rest] = part.split("<<END>>");
              return [
                <mark key={`m_${i}`} className="rounded bg-primary/20 px-1">
                  {hit}
                </mark>,
                rest ?? "",
              ];
            })}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
