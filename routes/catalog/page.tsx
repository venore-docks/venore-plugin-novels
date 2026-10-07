import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { isPluginActive } from "@venore/plugin-sdk";
import { listPublishedWorks } from "../../index";
import { WorkCardGrid } from "../../components/work-card-grid";
import { PLUGIN_KEY, PUBLIC_BASE_PATH } from "../../shared/constants";
import { pickText } from "../../shared/localized-text";

// Catálogo público. ?tag=<slug> filtra por uma tag do catálogo e vira a "página da tag" (título e
// descrição da tag no topo).
export default async function NovelsCatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isPluginActive(PLUGIN_KEY))) notFound();
  const query = await searchParams;
  const tagSlug = typeof query.tag === "string" ? query.tag : undefined;
  const result = await listPublishedWorks({ tag: tagSlug });
  const view = result.success ? result.data : { works: [], badges: { interactive: {}, textOnly: {}, aiAudio: {} }, tag: null };
  const tagName = view.tag ? pickText(view.tag.name, "pt-BR", "pt-BR") : null;
  const tagDescription = view.tag ? pickText(view.tag.description, "pt-BR", "pt-BR") : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{tagName ?? "Graphic novels"}</h1>
        {tagDescription && <p className="text-muted-foreground">{tagDescription}</p>}
        {tagSlug && (
          <Link href={PUBLIC_BASE_PATH} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground">
            <X className="size-3.5" aria-hidden />
            {tagName ? `Tirar o filtro "${tagName}"` : "Ver todas as obras"}
          </Link>
        )}
      </div>
      {view.works.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tagSlug ? "Nenhuma obra publicada com essa tag." : "Nenhuma obra publicada ainda."}</p>
      ) : (
        <WorkCardGrid works={view.works} badges={view.badges} />
      )}
    </div>
  );
}
