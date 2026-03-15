import { Card, CardContent } from "@/components/ui/card";

export function TLChatSkeleton() {
  return (
    <div className="grid gap-4">
      <Card className="tl-surface">
        <CardContent className="p-6">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="mt-4 h-3 w-full bg-muted rounded" />
          <div className="mt-2 h-3 w-5/6 bg-muted rounded" />
        </CardContent>
      </Card>
      <Card className="tl-surface">
        <CardContent className="p-6">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="mt-4 h-3 w-full bg-muted rounded" />
          <div className="mt-2 h-3 w-4/6 bg-muted rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
