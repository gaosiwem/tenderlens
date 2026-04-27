import { Card, CardContent } from "@/components/ui/card";

export function TLKeyValueGrid(props: {
  title: string;
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-0">
        <div className="px-5 py-4">
          <div className="font-display text-sm font-extrabold">
            {props.title}
          </div>
        </div>
        <div className="tl-divider" />
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {props.items.map((it, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-background/30 p-4"
              >
                <div className="text-xs font-semibold tracking-wide text-muted-foreground ">
                  {it.label}
                </div>
                <div className="mt-2 text-sm font-semibold break-words">
                  {it.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
