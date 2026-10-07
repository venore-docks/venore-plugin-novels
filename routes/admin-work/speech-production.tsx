"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import type { SpeechState } from "@venore/plugin-sdk/speech";
import { Button, useActionToast } from "@venore/plugin-sdk/ui";
import { deleteWorkSpeechAction, generateWorkSpeechAction, type AdminActionState } from "../admin/actions";

const REFRESH_MS = 15_000;
const initialState: AdminActionState = { error: null };

function ActionButton({
  workId,
  action,
  mode,
  label,
  confirm,
  done,
  variant = "outline",
}: {
  workId: string;
  action: typeof generateWorkSpeechAction;
  mode?: "missing" | "all";
  label: string;
  confirm?: string;
  done: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useActionToast({ pending, error: state.error, successMessage: done });
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="workId" value={workId} />
      {mode && <input type="hidden" name="mode" value={mode} />}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {label}
      </Button>
    </form>
  );
}

// Bloco "Áudio" da obra: produção das faixas (cena x idioma) contra o texto atual e as ações do
// autor. Salvar a obra não gera nem muda o áudio: texto mudado fica "desatualizado" (o áudio antigo
// continua tocando) até o autor gerar de novo. Enquanto há fila ou o worker trabalha, a página se
// atualiza sozinha (router.refresh: só os dados, o formulário não perde o que foi digitado).
export function SpeechProduction({
  workId,
  status,
  state,
  hasAudio,
  workerText,
  workerBusy,
}: {
  workId: string;
  status: string;
  state: SpeechState | null;
  hasAudio: boolean;
  workerText: string | null;
  workerBusy: boolean;
}) {
  const router = useRouter();
  const queued = (state?.pending ?? 0) + (state?.processing ?? 0);
  const live = queued > 0 || workerBusy;

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, router]);

  const total = state?.total ?? 0;
  const ready = state?.ready ?? 0;
  const processing = state?.processing ?? 0;
  const current = state?.currentPercent ?? 0;
  const readyPercent = total > 0 ? Math.round((ready / total) * 100) : 0;
  const producedPercent = total > 0 ? Math.min(100, Math.round(((ready + processing * (current / 100)) / total) * 100)) : 0;
  const parts = state
    ? [
        `${ready} de ${total} ${total === 1 ? "faixa em dia" : "faixas em dia"}`,
        state.outdated > 0 ? `${state.outdated} desatualizada${state.outdated === 1 ? "" : "s"}` : null,
        state.missing > 0 ? `${state.missing} sem áudio` : null,
        processing > 0 ? `gerando agora${current ? ` (${current}% da faixa)` : ""}` : null,
        state.pending > 0 ? `${state.pending} na fila` : null,
        state.failed > 0 ? `${state.failed} com falha` : null,
      ].filter(Boolean)
    : [];
  const canAct = Boolean(state?.active) && total > 0 && queued === 0;
  const toGenerate = (state?.missing ?? 0) + (state?.outdated ?? 0) + (state?.failed ?? 0) + (state?.extra ? 1 : 0);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">Áudio</p>
      <p className="text-xs text-muted-foreground">{status}</p>
      {hasAudio && total > 0 && (
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
          {state?.failed && state.lastError ? <p className="text-xs text-destructive">Último erro: {state.lastError}</p> : null}
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
      <div className="flex flex-wrap gap-2 pt-1">
        {canAct && toGenerate > 0 && (
          <ActionButton
            workId={workId}
            action={generateWorkSpeechAction}
            mode="missing"
            variant="default"
            label={hasAudio ? "Gerar o que falta" : "Gerar áudio"}
            done="Na fila: o worker já foi chamado."
          />
        )}
        {canAct && ready + (state?.outdated ?? 0) > 0 && (
          <ActionButton
            workId={workId}
            action={generateWorkSpeechAction}
            mode="all"
            label="Gerar tudo de novo"
            done="Todas as faixas voltaram para a fila."
            confirm="Gerar de novo todas as faixas desta obra? O áudio atual de cada faixa sai até a nova ficar pronta."
          />
        )}
        {hasAudio && (
          <ActionButton
            workId={workId}
            action={deleteWorkSpeechAction}
            label="Apagar áudio"
            done="Áudio apagado."
            variant="destructive"
            confirm="Apagar todo o áudio desta obra? O botão de ouvir some do leitor."
          />
        )}
      </div>
    </div>
  );
}
