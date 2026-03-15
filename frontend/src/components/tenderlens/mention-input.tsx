"use client";

import * as React from "react";
import { useOrgMembers } from "@/hooks/use-org-members";

interface TLMentionInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TLMentionInput(props: TLMentionInputProps) {
  const { items } = useOrgMembers();
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    props.onChange(v);

    // Check for @ mention at cursor position
    const cursor = e.target.selectionStart;
    const textBeforeCursor = v.slice(0, cursor);
    const match = textBeforeCursor.match(/@([A-Za-z0-9._%+-]*)$/);

    if (match) {
      const query = match[1].toLowerCase();
      const emails = items
        .map((m) => m.email)
        .filter((e): e is string => !!e && e.toLowerCase().includes(query))
        .slice(0, 5);

      setSuggestions(emails);
      // Position could be calculated better, but for now we just show it below
    } else {
      setSuggestions([]);
    }
  }

  function applySuggestion(email: string) {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const text = props.value;
    const textBeforeCursor = text.slice(0, cursor);
    const textAfterCursor = text.slice(cursor);

    const match = textBeforeCursor.match(/@([A-Za-z0-9._%+-]*)$/);
    if (match) {
      const prefix = textBeforeCursor.slice(0, match.index);
      const newValue = `${prefix}@${email} ${textAfterCursor}`;
      props.onChange(newValue);
      setSuggestions([]);
      // Restore focus?
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  return (
    <div className="relative space-y-2">
      <textarea
        ref={textareaRef}
        className={`w-full min-h-[100px] rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${props.className}`}
        value={props.value}
        onChange={handleChange}
        placeholder={
          props.placeholder ?? "Write a comment... (Use @email to mention)"
        }
        disabled={props.disabled}
      />

      {suggestions.length > 0 && (
        <div className="absolute z-50 w-64 rounded-xl border border-border bg-popover p-1 shadow-md text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Mention user
          </div>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => applySuggestion(s)}
              className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
