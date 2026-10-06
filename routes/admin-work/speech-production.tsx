"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { SpeechProgress } from "@venore/plugin-sdk/speech";

const REFRESH_MS = 15_000;

// Produção do áudio da obra: cada faixa é o texto de uma cena num idioma. A barra cheia são as
// faixas prontas; o trecho pulsando é quanto da faixa em geração o worker já fez (ele informa a
// cada poucos segundos). Enquanto há faixa na fila ou o worker está trabalhando, a página se
// atualiza sozinha (router.refresh: só os dados, o formulário não perde o que foi digitado).
export function SpeechProduction({
  status,
  progress,
  workerText,
  workerBusy,
}: {
  status: string;
  progress: SpeechProgress | null;
  workerText: string | null;
  workerBusy: boolean;
}) {
  const router = useRouter();
  const queued = (progress?.pending ?? 0) + (progress?.processing ?? 0);
  const live = queued > 0 || workerBusy;

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, router]);

  const total = progress?.total ?? 0;
  const ready = progress?.ready ?? 0;
  const processing = progress?.processing ?? 0;
  const current = progress?.currentPercent ?? 0;
  const readyPercent = total > 0 ? Math.round((ready / total) * 100) : 0;
  const producedPercent = total > 0 ? Math.min(100, Math.round(((ready + processing * (current / 100)) / total) * 100)) : 0;
  const parts = progress
    ? [
        `${ready} de ${total} ${total === 1 ? "faixa pronta" : "faixas prontas"}`,
        processing > 0 ? `gerando agora${current ? ` (${current}% da faixa)` : ""}` : null,
        progress.pending > 0 ? `${progress.pending} na fila` : null,
        progress.failed > 0 ? `${progress.failed} com falha` : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">Áudio</p>
      <p className="text-xs text-muted-foreground">{status}</p>
      {total > 0 && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-label="Produção do áudio"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={producedPercent}
            aria-valuetext={parts.join(", ")}
            className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary" style={{ width: `${readyPercent}%` }} />
            {processing > 0 && (
              <div className="h-full animate-pulse bg-primary/50" style={{ width: `${producedPercent - readyPercent}%`, minWidth: "4%" }} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {producedPercent}% · {parts.join(" · ")}
          </p>
          {progress?.failed && progress.lastError ? <p className="text-xs text-destructive">Último erro: {progress.lastError}</p> : null}
        </div>
      )}
      {workerText && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <span
            aria-hidden
            className={workerBusy ? "size-2 shrink-0 animate-pulse rounded-full bg-primary" : "size-2 shrink-0 rounded-full bg-muted-foreground/56"}
          />
          {workerText}
        </p>
      )}
    </div>
  );
}
