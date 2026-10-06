import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied, AdminPageHeader, Badge, EmptyState } from "@venore/plugin-sdk/ui";
import { listWorks } from "../../index";
import { WorkCover } from "../../components/work-cover";
import { adminWorkPath } from "../../shared/constants";
import { pickText } from "../../shared/localized-text";
import { localeLabel } from "../../shared/locales";
import { StatusBadge } from "../../components/status-badge";
import { CreateWorkDialog } from "./create-work-dialog";

export default async function NovelsAdminPage() {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;

  const result = await listWorks();
  if (!result.success) {
    return <p className="text-sm text-destructive">Erro ao carregar obras: {result.error.message}</p>;
  }
  const works = result.data;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Graphic Novels"
        description="Obras interativas: lâminas com texto, escolhas que ramificam a história e finais."
        actions={works.length > 0 ? <CreateWorkDialog /> : null}
      />

      {works.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-8" strokeWidth={1.5} />}
          title="Nenhuma obra ainda"
          description="Crie a primeira obra ou popule a obra de exemplo em Plugins."
          action={<CreateWorkDialog />}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((work) => {
            const title = pickText(work.title, work.defaultLocale, work.defaultLocale);
            return (
              <li key={work.id}>
                <Link
                  href={adminWorkPath(work.id)}
                  className="flex gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:border-ring"
                >
                  <WorkCover url={work.coverUrl} title={title} className="w-20 shrink-0" />
                  <div className="min-w-0 space-y-2">
                    <p className="line-clamp-2 font-medium text-foreground">{title}</p>
                    <StatusBadge status={work.status} />
                    <p className="text-xs text-muted-foreground">
                      {work.chapterCount} cap. · {work.sceneCount} cenas
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {work.locales.map((locale) => (
                        <Badge key={locale} variant="outline">
                          {localeLabel(locale)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
