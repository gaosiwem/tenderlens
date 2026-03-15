import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "./button";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function TLEmptyState({
  title,
  description,
  action,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 text-center">
        <div className="font-display text-base font-extrabold">{title}</div>
        <div className="mt-2 text-sm text-muted-foreground">{description}</div>
        {(action || (actionLabel && onAction)) && (
          <div className="mt-4">
            {action || <TLButton onClick={onAction}>{actionLabel}</TLButton>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const TenderLensEmptyStateCard = TLEmptyState;
