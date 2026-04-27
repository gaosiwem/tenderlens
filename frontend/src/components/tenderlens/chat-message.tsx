import { Card, CardContent } from "@/components/ui/card";
import type { Message } from "@/lib/chat.types";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Bot, Sparkles, User2 } from "lucide-react";

export function TLChatMessage(props: {
  m: Message;
  actions?: React.ReactNode;
}) {
  const isUser = props.m.role === "user";
  const time = new Date(props.m.createdAt).toLocaleString();
  const speakerLabel = isUser ? "You" : "TenderLens AI";

  return (
    <div
      className={cn(
        "w-full flex group",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <Card
        className={cn(
          "w-full overflow-hidden shadow-sm",
          isUser
            ? "max-w-[720px] border-primary/20 bg-primary text-primary-foreground rounded-[24px] rounded-br-md"
            : "tl-surface max-w-[980px] border-border/70 bg-card rounded-[24px] rounded-bl-md",
        )}
      >
        <CardContent className={cn("p-5", !isUser && "md:p-6")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-2xl border",
                  isUser
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-primary/20 bg-primary/10 text-primary",
                )}
              >
                {isUser ? <User2 className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div>
                <div
                  className={cn(
                    "font-display text-sm font-extrabold",
                    isUser ? "text-white" : "text-foreground",
                  )}
                >
                  {speakerLabel}
                </div>
                {!isUser ? (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-primary/80">
                    <Sparkles className="size-3" />
                    Answer grounded in tender context
                  </div>
                ) : null}
              </div>
            </div>
            <div
              className={cn(
                "text-xs",
                isUser ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {time}
            </div>
          </div>

          <div
            className={cn(
              "mt-4 whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
              isUser
                ? "text-sm leading-6 text-primary-foreground/95"
                : "text-[15px] leading-7 text-foreground/90",
            )}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p
                    className={cn(
                      "mb-3 last:mb-0",
                      isUser ? "leading-6" : "leading-7",
                    )}
                  >
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul
                    className={cn(
                      "pl-5 mb-3 last:mb-0",
                      isUser ? "list-disc space-y-1" : "list-disc space-y-2",
                    )}
                  >
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol
                    className={cn(
                      "list-decimal pl-5 mb-3 last:mb-0",
                      isUser ? "space-y-1" : "space-y-2",
                    )}
                  >
                    {children}
                  </ol>
                ),
                h2: ({ children }) =>
                  isUser ? (
                    <p className="mb-3 text-sm font-semibold">{children}</p>
                  ) : (
                    <h2 className="mt-6 mb-3 font-display text-lg font-black tracking-tight first:mt-0">
                      {children}
                    </h2>
                  ),
                h3: ({ children }) =>
                  isUser ? (
                    <p className="mb-2 text-sm font-semibold">{children}</p>
                  ) : (
                    <h3 className="mt-5 mb-2 text-base font-bold tracking-tight first:mt-0">
                      {children}
                    </h3>
                  ),
                li: ({ children }) => (
                  <li className={cn(isUser ? "leading-6" : "leading-7")}>
                    {children}
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote
                    className={cn(
                      "border-l-2 pl-4 italic",
                      isUser
                        ? "border-white/30 text-primary-foreground/80"
                        : "border-primary/30 text-muted-foreground",
                    )}
                  >
                    {children}
                  </blockquote>
                ),
              }}
            >
              {props.m.content || ""}
            </ReactMarkdown>
          </div>

          {!isUser && props.actions ? (
            <div className="mt-3 flex items-center gap-2">{props.actions}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
