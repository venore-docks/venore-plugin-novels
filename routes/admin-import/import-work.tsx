"use client";

import { useRef, useState, useTransition } from "react";
import { FileJson, Upload } from "lucide-react";
import { Badge, Button } from "@venore/plugin-sdk/ui";
import type { LocalizedText } from "../../contracts/types";
import { pickText } from "../../shared/localized-text";
import { importWorkAction } from "../admin/actions";

type ExampleCard = { key: string; kindLabel: string; title: LocalizedText; synopsis: LocalizedText; chapters: number; scenes: number; endings: number };

const text = (value: LocalizedText) => pickText(value, "pt-BR", "pt-BR");

export function ImportWork({ examples }: { examples: ExampleCard[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function run(key: string, source: Parameters<typeof importWorkAction>[0]) {
    setErrors([]);
    setBusyKey(key);
    startTransition(async () => {
      // Sucesso redireciona para a obra nova; só o erro volta para cá.
      const result = await importWorkAction(source);
      if (!result.ok) setErrors(result.error.split("\n"));
      setBusyKey(null);
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    run("arquivo", { kind: "file", content: await file.text() });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground">Arquivo de obra</h2>
          <p className="text-sm text-muted-foreground">
            Um arquivo exportado de outra obra (botão Exportar no editor) ou escrito à mão no formato <code>venore-novels-work</code>. Endereço repetido ganha um sufixo.
          </p>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Arquivo da obra" onChange={(event) => void onFile(event.target.files?.[0])} />
        <Button type="button" disabled={pending} onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />
          {busyKey === "arquivo" ? "Importando..." : "Escolher arquivo"}
        </Button>
        {errors.length > 0 && (
          <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">O arquivo não foi importado:</p>
            <ul className="list-disc space-y-0.5 ps-5">
              {errors.map((error, index) => (
                <li key={index} className="break-words">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground">Histórias de exemplo</h2>
          <p className="text-sm text-muted-foreground">Uma obra completa para cada tipo: importe, jogue no modo teste e use como ponto de partida.</p>
        </div>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {examples.map((example) => (
            <li key={example.key} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/14 text-primary">
                  <FileJson className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">{text(example.title)}</p>
                  <Badge variant="secondary">{example.kindLabel}</Badge>
                </div>
              </div>
              {text(example.synopsis) && <p className="line-clamp-4 text-sm text-muted-foreground">{text(example.synopsis)}</p>}
              <p className="text-xs text-muted-foreground">
                {example.chapters} capítulos · {example.scenes} cenas · {example.endings} finais
              </p>
              <Button type="button" variant="outline" className="mt-auto" disabled={pending} onClick={() => run(example.key, { kind: "example", key: example.key })}>
                {busyKey === example.key ? "Importando..." : "Importar como rascunho"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
