import { Badge } from "@venore/plugin-sdk/ui";
import type { WorkStatus } from "../contracts/types";

const LABELS: Record<WorkStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  published: "Publicada",
  rejected: "Recusada",
};

export function StatusBadge({ status }: { status: WorkStatus }) {
  return <Badge variant={status === "published" ? "default" : "secondary"}>{LABELS[status]}</Badge>;
}
