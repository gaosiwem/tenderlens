import Link from "next/link";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TLButton } from "@/components/tenderlens/button";

export function TLSpendGuardBanner(props: {
  kind: "policy" | "disabled";
  message: string;
}) {
  return (
    <div className="tl-surface p-5">
      <TLInlineAlert
        title={
          props.kind === "policy" ? "Policy blocked request" : "Chat disabled"
        }
        description={props.message}
        tone={props.kind === "policy" ? "error" : "neutral"}
      />
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <Link href="/settings/billing">
          <TLButton>Upgrade Plan</TLButton>
        </Link>
        <Link href="/chat">
          <TLButton variant="secondary">Back to Chat</TLButton>
        </Link>
      </div>
    </div>
  );
}
