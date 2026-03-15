import { TLInlineAlert } from "@/components/tenderlens/inline-alert";

export function TLSpendGuardAlert(props: {
  title: string;
  description: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const mapTone = (t?: string) => {
    if (t === "danger") return "error";
    return t as "neutral" | "warning" | "error" | "success" | undefined;
  };

  return (
    <TLInlineAlert
      title={props.title}
      description={props.description}
      tone={mapTone(props.tone) ?? "warning"}
    />
  );
}
