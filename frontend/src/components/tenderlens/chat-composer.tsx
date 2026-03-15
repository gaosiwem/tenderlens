import * as React from "react";
import { Input } from "@/components/ui/input";
import { TLButton } from "@/components/tenderlens/button";

export function TLChatComposer(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="tl-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              props.onSend();
            }
          }}
          className="h-11"
          placeholder={
            props.placeholder ??
            "Ask about deadlines, requirements, pricing, mandatory briefing, submission format"
          }
          disabled={props.disabled}
        />
        <TLButton
          onClick={props.onSend}
          disabled={props.disabled || !props.value.trim()}
        >
          {props.sending ? "Sending..." : "Send"}
        </TLButton>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        The assistant answers using tender chunks only. Always verify critical
        details in the cited sections.
      </div>
    </div>
  );
}
