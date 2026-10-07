import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied, Button, cn } from "@venore/plugin-sdk/ui";
import { getCachedWork, type WorkEditorView } from "../../index";
import { StatusBadge } from "../../components/status-badge";
import { WorkCover } from "../../components/work-cover";
import { adminWorkTabPath, publicWorkPath } from "../../shared/constants";
import { pickText } from "../../shared/localized-text";
import { CastManager } from "./cast-manager";
import { ChapterList } from "./chapter-list";
import { IssueList } from "./issue-list";
import { PublishControls } from "./publish-controls";
import { SpeechProduction } from "./speech-production";
import { VariablesForm } from "./variables-form";
import { WorkSettingsForm } from "./work-settings-form";

type SpeechView = WorkEditorView["speech"];

// Abas da página da obra (0.9.0), no lugar da página única.
const TABS = [
  { key: "historia", label: "História" },
  { key: "sistema", label: "Sistema" },
  { key: "elenco", label: "Elenco" },
  { key: "configuracoes", label: "Configurações" },
  { key: "audio", label: "Áudio" },
  { key: "publicacao", label: "Publicação" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `há ${hours} h` : `há ${Math.round(hours / 24)} dias`;
}

// Texto da aba "Áudio": situação das faixas contra o texto atual e o que o worker de áudio do
// core está fazendo. Salvar/publicar não mexe no áudio; as ações ficam na própria aba.
function describeSpeech(speech: SpeechView) {
  const state = speech.state;
  const queued = (state?.pending ?? 0) + (state?.processing ?? 0);
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const hasAudio = state ? state.ready + state.outdated + queued + state.failed + state.extra > 0 : false;
  const status = !state
    ? "Não foi possível ler a situação do áudio agora."
    : state.total === 0
      ? "Nenhuma cena com texto ainda."
      : !state.active
        ? "A leitura em voz alta está desligada: ligue em Editorial → Áudios."
        : !hasAudio
          ? "Sem áudio. Gere quando o texto estiver pronto — salvar a obra não gera nem muda o áudio."
          : state.outdated > 0
            ? `${plural(state.outdated, "faixa com texto mudado", "faixas com texto mudado")}: o áudio antigo continua tocando até você gerar de novo.`
            : state.ready === state.total
              ? `Áudio em dia: ${plural(state.ready, "faixa", "faixas")} (cada cena em cada idioma).`
              : "Cada cena em cada idioma vira uma faixa de áudio.";

  const worker = speech.worker;
  let workerText: string | null = null;
  let workerBusy = false;
  if (worker.mode === "worker") {
    if (worker.stage === "generating") {
      workerBusy = true;
      workerText = `Worker gerando áudio agora (começou ${timeAgo(worker.since)}).`;
    } else if (worker.stage === "preparing") {
      workerBusy = true;
      workerText = `Worker preparando as vozes (${timeAgo(worker.since)}); a geração começa em alguns minutos.`;
    } else if (queued > 0) {
      workerText =
        worker.stage === "silent"
          ? `Worker parou de responder (último sinal ${timeAgo(worker.lastSignalAt)}). A fila espera a próxima execução.`
          : `Na fila, esperando o worker${worker.lastSignalAt ? ` (última execução ${timeAgo(worker.lastSignalAt)})` : ""}.`;
    }
  }
  return { status, state, hasAudio, workerText, workerBusy };
}

export default async function WorkEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;

  const [{ workId }, query] = await Promise.all([params, searchParams]);
  const result = await getCachedWork(workId);
  if (!result.success) notFound();
  const view = result.data;
  const { work, coverUrl, chapters, issues } = view;
  const tab: TabKey = TABS.some((entry) => entry.key === query.tab) ? (query.tab as TabKey) : "historia";
  const title = pickText(work.title, work.defaultLocale, work.defaultLocale);
  const subtitle = pickText(work.subtitle, work.defaultLocale, work.defaultLocale);
  const errors = issues.filter((issue) => issue.severity === "error").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <WorkCover url={coverUrl} focus={work.coverFocus} title={title} className="w-20 shrink-0 sm:w-24" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge status={work.status} />
            <span className="text-xs text-muted-foreground">/novels/{work.slug}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {work.status === "published" && (
            <Button variant="outline" asChild>
              <Link href={publicWorkPath(work.slug)} target="_blank">
                <ExternalLink className="size-4" />
                Ver no site
              </Link>
            </Button>
          )}
          <PublishControls workId={work.id} status={work.status} blocked={errors > 0} />
        </div>
      </header>

      <nav aria-label="Seções da obra" className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map((entry) => (
            <li key={entry.key}>
              <Link
                href={adminWorkTabPath(work.id, entry.key)}
                aria-current={tab === entry.key ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                  tab === entry.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.label}
                {entry.key === "publicacao" && errors > 0 && (
                  <span className="rounded-full bg-destructive/10 px-1.5 text-xs font-medium text-destructive">{errors}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "historia" && (
        <section className="space-y-3">
          {errors > 0 && (
            <p className="text-sm text-muted-foreground">
              {errors} {errors === 1 ? "problema impede" : "problemas impedem"} a publicação —{" "}
              <Link href={adminWorkTabPath(work.id, "publicacao")} className="text-primary hover:underline">
                ver na aba Publicação
              </Link>
              .
            </p>
          )}
          <ChapterList work={work} chapters={chapters} />
        </section>
      )}
      {tab === "sistema" && <VariablesForm work={work} />}
      {tab === "elenco" && <CastManager work={work} cast={view.cast} media={view.media} />}
      {tab === "configuracoes" && <WorkSettingsForm work={work} coverUrl={coverUrl} tagCatalog={view.tagCatalog} tagIds={view.tagIds} />}
      {tab === "audio" && <SpeechProduction workId={work.id} {...describeSpeech(view.speech)} />}
      {tab === "publicacao" && (
        <section className="space-y-4">
          {issues.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">Nenhum problema: a obra pode ser publicada.</p>
          ) : (
            <IssueList workId={work.id} issues={issues} chapters={chapters} />
          )}
        </section>
      )}
    </div>
  );
}
