import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied, AdminPageHeader, Button } from "@venore/plugin-sdk/ui";
import { getCachedWork } from "../../index";
import { StatusBadge } from "../../components/status-badge";
import { publicWorkPath } from "../../shared/constants";
import { pickText } from "../../shared/localized-text";
import { ChapterList } from "./chapter-list";
import { IssueList } from "./issue-list";
import { PublishControls } from "./publish-controls";
import { WorkSettingsForm } from "./work-settings-form";

export default async function WorkEditorPage({ params }: { params: Promise<{ workId: string }> }) {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;

  const { workId } = await params;
  const result = await getCachedWork(workId);
  if (!result.success) notFound();
  const { work, coverUrl, chapters, issues } = result.data;
  const title = pickText(work.title, work.defaultLocale, work.defaultLocale);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={title}
        description={`/novels/${work.slug}`}
        actions={
          <>
            <StatusBadge status={work.status} />
            {work.status === "published" && (
              <Button variant="outline" asChild>
                <Link href={publicWorkPath(work.slug)} target="_blank">
                  <ExternalLink className="size-4" />
                  Ver no site
                </Link>
              </Button>
            )}
            <PublishControls workId={work.id} status={work.status} blocked={issues.some((issue) => issue.severity === "error")} />
          </>
        }
      />

      <IssueList workId={work.id} issues={issues} chapters={chapters} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-caps text-muted-foreground">Capítulos</h2>
          <ChapterList work={work} chapters={chapters} />
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-caps text-muted-foreground">Obra</h2>
          <WorkSettingsForm work={work} coverUrl={coverUrl} />
        </section>
      </div>
    </div>
  );
}
