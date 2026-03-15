"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TLButton } from "@/components/tenderlens/button";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import type { ChecklistItem } from "@/lib/checklist.types";

function priorityTone(mandatory: boolean) {
  if (mandatory) return "border-primary/40 bg-primary/5";
  return "border-border bg-background";
}

function normalizeChecklistText(value: string) {
  return value
    .replace(/\bqualification[\s_-]*fit\b/gi, "")
    .replace(/\beligibility[\s_-]*match\b/gi, "")
    .replace(/\beligibility\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function shouldHideCategoryBadge(category: string, mandatory: boolean) {
  if (!mandatory) return false;
  return /mandatory/i.test(category);
}

export function TLChecklistView(props: {
  title: string;
  items: ChecklistItem[];
  onToggleItem?: (index: number, checked: boolean) => void;
  onSaveNote?: (
    index: number,
    notes: string,
  ) => Promise<boolean | void> | boolean | void;
  savingByIndex?: Record<number, boolean>;
  disabled?: boolean;
}) {
  const [noteDialogIndex, setNoteDialogIndex] = React.useState<number | null>(
    null,
  );
  const [noteDraft, setNoteDraft] = React.useState("");
  const [noteSaving, setNoteSaving] = React.useState(false);

  function openNoteDialog(index: number) {
    setNoteDialogIndex(index);
    setNoteDraft(props.items[index]?.notes ?? "");
  }

  function closeNoteDialog(open: boolean) {
    if (noteSaving) return;
    if (open) return;
    setNoteDialogIndex(null);
    setNoteDraft("");
  }

  async function saveNoteFromDialog() {
    if (noteDialogIndex === null) return;
    if (!props.onSaveNote) {
      setNoteDialogIndex(null);
      setNoteDraft("");
      return;
    }

    setNoteSaving(true);
    const saved = await props.onSaveNote(noteDialogIndex, noteDraft);
    setNoteSaving(false);
    if (saved === false) return;
    setNoteDialogIndex(null);
    setNoteDraft("");
  }

  const activeTask =
    noteDialogIndex !== null ? props.items[noteDialogIndex]?.task ?? "" : "";

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div className="font-display text-sm font-extrabold">{props.title}</div>
        <div className="text-xs text-muted-foreground">
          Use this as a starting point. Validate requirements before submission.
        </div>

        <div className="grid gap-3">
          {props.items.map((i, idx) => {
            const categoryLabel = normalizeChecklistText(i.category).trim();
            const hideCategory = shouldHideCategoryBadge(
              categoryLabel,
              i.mandatory,
            );
            const checked = Boolean(i.checked);
            const saving = Boolean(props.savingByIndex?.[idx]);

            return (
              <div
                key={`${i.task}-${idx}`}
                className={`border rounded-xl p-3 space-y-2 ${priorityTone(i.mandatory)}`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 cursor-pointer accent-primary"
                      checked={checked}
                      disabled={props.disabled || !props.onToggleItem || saving}
                      onChange={(event) =>
                        props.onToggleItem?.(idx, event.target.checked)
                      }
                    />
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold break-words ${
                          checked ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {normalizeChecklistText(i.task)}
                      </div>
                      <a
                        href="#"
                        className={`mt-1 inline-block text-xs underline ${
                          props.disabled || saving
                            ? "pointer-events-none text-muted-foreground"
                            : "text-primary hover:text-primary/80"
                        }`}
                        onClick={(event) => {
                          event.preventDefault();
                          if (props.disabled || saving) return;
                          openNoteDialog(idx);
                        }}
                      >
                        {(i.notes ?? "").trim() ? "Edit note" : "Add note"}
                      </a>
                      {(i.notes ?? "").trim() ? (
                        <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words rounded-md border border-border/60 bg-background/60 px-2 py-1.5">
                          {i.notes}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.mandatory && <TLCodeBadge value="Mandatory" />}
                    {!hideCategory && categoryLabel.length > 0 && (
                      <TLCodeBadge value={categoryLabel} />
                    )}
                    {saving && <TLCodeBadge value="Saving..." />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={noteDialogIndex !== null} onOpenChange={closeNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Checklist note
            </DialogTitle>
            <DialogDescription>
              {normalizeChecklistText(activeTask)}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Add your note..."
            className="min-h-32 text-sm"
            disabled={noteSaving}
          />

          <DialogFooter>
            <TLButton
              variant="secondary"
              onClick={() => closeNoteDialog(false)}
              disabled={noteSaving}
            >
              Cancel
            </TLButton>
            <TLButton onClick={saveNoteFromDialog} loading={noteSaving}>
              Save note
            </TLButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
