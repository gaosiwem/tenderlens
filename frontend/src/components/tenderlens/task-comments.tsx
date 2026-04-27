"use client";

import * as React from "react";
import { toast } from "sonner";
import { TLButton } from "@/components/tenderlens/button";
import { TLMentionInput } from "@/components/tenderlens/mention-input";
import { addComment } from "@/lib/workspace.api";
import type { BidTaskComment } from "@/lib/workspace.types";
import { UserIcon, SendIcon, MessageSquareIcon } from "lucide-react";

export function TLTaskComments(props: {
  tenderId: string;
  taskId: string;
  comments: BidTaskComment[];
  onCommentAdded: () => void;
}) {
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    if (!content.trim()) return;
    setSubmitting(true);
    const res = await addComment(props.tenderId, props.taskId, content.trim());
    setSubmitting(false);
    if (!res.ok) {
      toast.error("Failed to add comment");
      return;
    }
    setContent("");
    props.onCommentAdded();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquareIcon size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold tracking-widest text-muted-foreground">
          Comments
        </span>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {props.comments.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center p-4">
            No comments yet.
          </div>
        ) : (
          props.comments.map((c) => (
            <div
              key={c.id}
              className="bg-background/40 border border-border/40 rounded-xl p-3 space-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                  <UserIcon size={10} />
                  {c.user?.name || "Team Member"}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              <div className="text-sm">{c.content}</div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-background/30 p-3">
        <div className="space-y-3">
          <TLMentionInput
            className="min-h-[96px] resize-y border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0"
            placeholder="Write a comment... Use @email to mention a teammate"
            value={content}
            onChange={(v) => setContent(v)}
            disabled={submitting}
          />
          <div className="flex justify-end">
            <TLButton
              size="sm"
              onClick={submit}
              loading={submitting}
              iconLeft={<SendIcon size={14} />}
            >
              Send Comment
            </TLButton>
          </div>
        </div>
      </div>
    </div>
  );
}
