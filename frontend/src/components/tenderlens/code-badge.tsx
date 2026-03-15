import { cn } from "@/lib/utils";

export function TLCodeBadge(props: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background/40 px-2.5 py-1",
        "text-xs font-semibold text-muted-foreground",
        props.className,
      )}
    >
      {props.value}
    </span>
  );
}
