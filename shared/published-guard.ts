import type { WorkStatus } from "../contracts/types";
import { hasBlockingIssues, validateStory, type ValidatableStory } from "./story-validation";

// Edição estrutural de obra já publicada (grafo, capítulos, variáveis) não pode deixar a obra
// com erro no ar. Devolve a mensagem do primeiro erro, ou null se a mudança é segura.
export function blockingIssueForPublished(status: WorkStatus, nextStory: ValidatableStory): string | null {
  if (status !== "published") return null;
  const issues = validateStory(nextStory);
  if (!hasBlockingIssues(issues)) return null;
  return issues.find((issue) => issue.severity === "error")?.message ?? "A obra ficaria com erro.";
}
