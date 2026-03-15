import { Card, CardContent } from "@/components/ui/card";

export function TLTableShell(props: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-0">
        {props.title || props.right ? (
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="font-display text-sm font-extrabold">
              {props.title ?? ""}
            </div>
            {props.right}
          </div>
        ) : null}
        <div className="tl-divider" />
        <div className="overflow-x-auto tl-scrollbar">{props.children}</div>
      </CardContent>
    </Card>
  );
}
