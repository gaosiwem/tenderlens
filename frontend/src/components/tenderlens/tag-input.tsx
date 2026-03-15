"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { TLButton } from "@/components/tenderlens/button";
import { X } from "lucide-react";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";

export function TLTagInput(props: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = React.useState("");

  function add() {
    const t = text.trim();
    if (!t) return;
    const next = Array.from(new Set([...props.value, t]));
    props.onChange(next);
    setText("");
  }

  function remove(tag: string) {
    props.onChange(props.value.filter((x) => x !== tag));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          className="h-11"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={props.placeholder ?? "Add keyword. Press Enter"}
        />
        <TLButton onClick={add} variant="secondary">
          Add
        </TLButton>
      </div>

      {props.value.length ? (
        <div className="flex flex-wrap gap-2">
          {props.value.map((tag) => (
            <button
              key={tag}
              onClick={() => remove(tag)}
              className="inline-flex items-center gap-1 group"
            >
              <TLCodeBadge
                value={tag}
                className="group-hover:opacity-80 transition-opacity"
              />
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
