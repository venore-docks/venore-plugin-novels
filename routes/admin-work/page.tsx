import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getPluginAdminPageData } from "@venore/plugin-sdk/admin";
import { AdminAccessDenied, AdminPageHeader, Button } from "@venore/plugin-sdk/ui";
import { getCachedWork, type WorkEditorView } from "../../index";
import { StatusBadge } from "../../components/status-badge";
import { publicWorkPath } from "../../shared/constants";
import { pickText } from "../../shared/localized-text";
import { ChapterList } from "./chapter-list";
import { IssueList } from "./issue-list";
import { PublishControls } from "./publish-controls";
import { SpeechProduction } from "./speech-production";
import { WorkSettingsForm } from "./work-settings-form";

type SpeechView = WorkEditorView["speech"];

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `há ${hours} h` : `há ${Math.round(hours / 24)} dias`;
}

// Texto do bloco "Áudio": situação da obra e o que o worker de áudio do core está fazendo.
function describeSpeech(workStatus: string, speech: SpeechView) {
  const progress = speech.progress;
  const queued = (progress?.pending ?? 0) + (progress?.processing ?? 0);
  const status =
    speech.expected === 0
      ? "Nenhuma cena com texto ainda."
      : workStatus !== "published" && !progress?.total
        ? "O áudio será gerado quando a obra for publicada."
        : !progress?.total
          ? "Esperando a leitura em voz alta ser ligada em Editorial → Áudios."
          : queued === 0 && progress.failed === 0
            ? `Áudio pronto: ${progress.ready} ${progress.ready === 1 ? "faixa" : "faixas"} (cada cena em cada idioma).`
            : "Cada cena em cada idioma vira uma faixa de áudio.";

  const worker = speech.worker;
  let workerText: string | null = null;
  let workerBusy = false;
  if (worker?.mode === "worker") {
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
  return { status, progress, workerText, workerBusy };
}

export default async function WorkEditorPage({ params }: { params: Promise<{ workId: string }> }) {
  const gate = await getPluginAdminPageData("novels");
  if (!gate.granted) return <AdminAccessDenied message="Você não tem permissão para gerenciar graphic novels." />;

  const { workId } = await params;
  const result = await getCachedWork(workId);
  if (!result.success) notFound();
  const { work, coverUrl, chapters, issues, speech } = result.data;
  const speechView = work.speechEnabled ? describeSpeech(work.status, speech) : null;
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
          {speechView && <SpeechProduction {...speechView} />}
          <WorkSettingsForm work={work} coverUrl={coverUrl} />
        </section>
      </div>
    </div>
  );
}
