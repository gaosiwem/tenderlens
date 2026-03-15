import { Card, CardContent } from "@/components/ui/card";
import { Bot, Sparkles } from "lucide-react";

export function TLTypingBubble(props: { text: string }) {
  return (
    <div className="w-full flex justify-start mb-4">
      <Card className="tl-surface max-w-[980px] w-full rounded-[24px] rounded-bl-md border-border/70 bg-card shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Bot className="size-4" />
              </div>
              <div>
                <div className="font-display text-sm font-extrabold">
                  TenderLens AI
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                  <Sparkles className="size-3" />
                  Generating answer
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground animate-pulse">
              Streaming
            </div>
          </div>
          <div className="mt-4 text-[15px] leading-7 whitespace-pre-wrap break-words text-foreground/90">
            {props.text || "..."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
