import { cn } from "@/lib/utils";

export function TextViewer({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text) {
    return (
      <div
        className={cn(
          "p-8 text-center text-neutral-500 italic bg-neutral-50 rounded-lg border border-dashed",
          className,
        )}
      >
        No text content available to display.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-6 bg-white rounded-lg border font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[80vh] overflow-y-auto",
        className,
      )}
    >
      {text}
    </div>
  );
}
