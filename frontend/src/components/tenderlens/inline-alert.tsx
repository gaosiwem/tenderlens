import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  HelpCircle,
} from "lucide-react";

type Variant = "info" | "success" | "warning" | "error" | "neutral";

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertCircle,
  error: XCircle,
  neutral: HelpCircle,
};

const styles = {
  info: "bg-blue-50 text-blue-900 border-blue-200",
  success: "bg-green-50 text-green-900 border-green-200",
  warning: "bg-yellow-50 text-yellow-900 border-yellow-200",
  error: "bg-red-50 text-red-900 border-red-200",
  neutral: "bg-gray-50 text-gray-900 border-gray-200",
};

export function TLInlineAlert({
  variant = "info",
  tone,
  title,
  description,
  children,
  className,
}: {
  variant?: Variant;
  tone?: Variant;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const finalVariant = tone || variant;
  const Icon = icons[finalVariant];

  return (
    <div
      className={cn(
        "rounded-md border p-4 flex gap-3",
        styles[finalVariant],
        className,
      )}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        {title && <h5 className="font-semibold mb-1">{title}</h5>}
        <div className="opacity-90">{description || children}</div>
      </div>
    </div>
  );
}
