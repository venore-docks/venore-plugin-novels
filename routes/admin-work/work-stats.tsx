import type { WorkStatsView } from "../../features/stats/get-work-stats/types";
import { pickText } from "../../shared/localized-text";

// Aba "Estatísticas" (seção 13): onde os leitores com conta param, que escolhas fazem, que finais
// veem e onde um recurso zerou. Agregado, sem identificar ninguém.
export function WorkStats({ stats, locale }: { stats: WorkStatsView; locale: string }) {
  if (stats.readers === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Ainda não há leitores com conta nesta obra. Quem lê sem login guarda o progresso só no navegador e não entra aqui.
      </p>
    );
  }
  const percent = (count: number) => `${Math.round((count / Math.max(1, stats.sampled)) * 100)}%`;
  const sceneList = (title: string, rows: WorkStatsView["stops"], empty: string) => (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.sceneId} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {row.label}
                  <span className="text-xs text-muted-foreground"> · {pickText(row.chapterTitle, locale, locale)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {row.count} ({percent(row.count)})
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: percent(row.count) }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Leitores com conta</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{stats.readers}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Num final agora</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{percent(stats.finished)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Finais diferentes vistos</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{stats.endings.length}</p>
        </div>
      </div>
      {stats.sampled < stats.readers && <p className="text-xs text-muted-foreground">Calculado com as {stats.sampled} partidas mais recentes.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {sceneList("Onde os leitores pararam", stats.stops, "Todo mundo chegou a um final.")}
        {sceneList("Finais alcançados", stats.endings, "Ninguém chegou a um final ainda.")}
        {sceneList("Onde um recurso zerou", stats.deaths, "Nenhum leitor caiu num gatilho de recurso.")}
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Escolhas mais feitas</h3>
          {stats.choices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma escolha registrada.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.choices.map((choice) => (
                <li key={choice.choiceId} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-foreground">
                    {pickText(choice.label, locale, locale) || "(sem texto)"}
                    <span className="text-xs text-muted-foreground"> · em {choice.sceneLabel}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {choice.count} · {choice.share}% da cena
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
