import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TLCardSkeleton() {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-10 w-40" />
      </CardContent>
    </Card>
  );
}
