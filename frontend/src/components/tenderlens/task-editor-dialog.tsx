"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TLButton } from "@/components/tenderlens/button";
import { TLTagInput } from "@/components/tenderlens/tag-input";
import type { BidTask } from "@/lib/workspace.types";
import { createTask, updateTask } from "@/lib/workspace.api";
import { TLUserPicker } from "@/components/tenderlens/user-picker";
import { CalendarIcon } from "lucide-react";

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDueAtIso(value: string) {
  if (!value.trim()) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  // Use end of local day so reminders and due-soon logic align with the selected date.
  return new Date(year, month - 1, day, 23, 59, 0, 0).toISOString();
}

export function TLTaskEditorDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenderId: string;
  task: BidTask | null;
  onSaved: () => Promise<void>;
}) {
  const isNew = !props.task;
  const [saving, setSaving] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [priority, setPriority] = React.useState<BidTask["priority"]>("MEDIUM");
  const [status, setStatus] = React.useState<BidTask["status"]>("TODO");
  const [ownerId, setOwnerId] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!props.open) return;
    const t = props.task;
    setTitle(t?.title ?? "");
    setDescription(t?.description ?? "");
    setDueAt(toDateInputValue(t?.dueAt));
    setPriority(t?.priority ?? "MEDIUM");
    setStatus(t?.status ?? "TODO");
    setOwnerId(t?.ownerId ?? "");
    setTags(t?.tags ?? []);
  }, [props.open, props.task]);

  async function save() {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);

    const payload: {
      title: string;
      description: string | null;
      dueAt: string | null;
      priority: BidTask["priority"];
      status: BidTask["status"];
      ownerId: string | null;
      tags: string[];
    } = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      dueAt: toDueAtIso(dueAt),
      priority,
      status,
      ownerId: ownerId.trim() ? ownerId.trim() : null,
      tags,
    };

    const res = isNew
      ? await createTask(props.tenderId, payload)
      : await updateTask(props.tenderId, props.task!.id, payload);

    setSaving(false);

    if (!res.ok) {
      toast.error("Save failed", { description: res.error.message });
      return;
    }
    toast.success("Saved");
    props.onOpenChange(false);
    await props.onSaved();
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isNew ? "New task" : "Edit task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Title
            </div>
            <Input
              className="h-11"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Description
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Due date
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 pl-10"
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </div>
                {dueAt ? (
                  <TLButton
                    type="button"
                    variant="secondary"
                    onClick={() => setDueAt("")}
                  >
                    Clear
                  </TLButton>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                Pick the task deadline from the calendar.
              </div>
            </div>
            <div className="space-y-2">
              <TLUserPicker
                value={ownerId || null}
                onChange={(v) => setOwnerId(v ?? "")}
              />
              <div className="text-xs text-muted-foreground">
                Assign a team member to this task.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Priority
              </div>
              <div className="flex flex-wrap gap-2">
                {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`px-3 py-2 rounded-xl border text-sm ${priority === p ? "border-primary/40 bg-primary/10" : "border-border bg-background"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Status
              </div>
              <div className="flex flex-wrap gap-2">
                {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-3 py-2 rounded-xl border text-sm ${status === s ? "border-primary/40 bg-primary/10" : "border-border bg-background"}`}
                    >
                      {s}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Tags
            </div>
            <TLTagInput
              value={tags}
              onChange={setTags}
              placeholder="Add tag and press Enter"
            />
          </div>

          <div className="flex justify-end gap-2">
            <TLButton
              variant="secondary"
              onClick={() => props.onOpenChange(false)}
            >
              Cancel
            </TLButton>
            <TLButton onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </TLButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
