import Link from "next/link";
import { AlertTriangle, CircleX } from "lucide-react";
import type { WorkEditorChapter } from "../../features/works/get-work/types";
import type { StoryIssue } from "../../shared/story-validation";
import { adminChapterPath } from "../../shared/constants";

const MAX_VISIBLE = 12;

export function IssueList({ workId, issues, chapters }: { workId: string; issues: StoryIssue[]; chapters: WorkEditorChapter[] }) {
  if (issues.length === 0) return null;
  const errors = issues.filter((issue) => issue.severity === "error");
  const sorted = [...errors, ...issues.filter((issue) => issue.severity === "warning")];
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));

  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        {errors.length > 0
          ? `${errors.length} ${errors.length === 1 ? "problema impede" : "problemas impedem"} a publicação`
          : "Pronta para publicar, com avisos"}
      </p>
      <ul className="space-y-1">
        {sorted.slice(0, MAX_VISIBLE).map((issue, index) => (
          <li key={`${issue.code}-${index}`} className="flex items-start gap-2 text-sm">
            {issue.severity === "error" ? (
              <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Erro" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Aviso" />
            )}
            {issue.chapterId && chapterIds.has(issue.chapterId) ? (
              <Link href={adminChapterPath(workId, issue.chapterId)} className="text-foreground hover:underline">
                {issue.message}
              </Link>
            ) : (
              <span className="text-foreground">{issue.message}</span>
            )}
          </li>
        ))}
      </ul>
      {sorted.length > MAX_VISIBLE && (
        <p className="text-xs text-muted-foreground">E mais {sorted.length - MAX_VISIBLE}.</p>
      )}
    </section>
  );
}
