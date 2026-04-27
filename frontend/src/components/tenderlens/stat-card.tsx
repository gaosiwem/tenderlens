import { Card, CardContent } from "@/components/ui/card";

export function TenderLensStatCard(props: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground ">
          {props.label}
        </div>
        <div className="mt-2 font-display text-2xl font-extrabold">
          {props.value}
        </div>
        {props.sublabel ? (
          <div className="mt-2 text-sm text-muted-foreground">
            {props.sublabel}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
