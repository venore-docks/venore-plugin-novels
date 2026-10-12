"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Puzzle, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Textarea } from "@venore/plugin-sdk/ui";
import type { SystemTemplateRecord } from "../../contracts/game";
import { pickText } from "../../shared/localized-text";
import { describePackage } from "../../shared/templates/package";
import { deleteSystemTemplateAction, importSystemTemplateAction } from "../admin/actions";

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SystemsAdmin({ templates }: { templates: SystemTemplateRecord[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const text = (value: Record<string, string>) => pickText(value, "pt-BR", "pt-BR");

  const importContent = (content: string) =>
    startTransition(async () => {
      const result = await importSystemTemplateAction(content);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Modelo importado.");
      setPasted("");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Importar modelo</h2>
        <p className="text-sm text-muted-foreground">Arquivo exportado da aba Sistema de uma obra ou daqui. Um modelo com a mesma chave é substituído.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Escolher arquivo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) importContent(await file.text());
            }}
          />
        </div>
        <Textarea value={pasted} onChange={(event) => setPasted(event.target.value)} rows={4} placeholder='Ou cole o JSON aqui ({"format": "venore-novels-system", ...})' className="font-mono text-xs" />
        <Button type="button" disabled={pending || !pasted.trim()} onClick={() => importContent(pasted)}>
          Importar o texto colado
        </Button>
      </section>

      <ul className="grid gap-3 md:grid-cols-2">
        {templates.map((template) => (
          <li key={template.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <Puzzle className="size-4 text-muted-foreground" aria-hidden />
                  {text(template.name)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {template.builtIn ? "vem com o plugin" : `importado · ${new Date(template.updatedAt).toLocaleDateString("pt-BR")}`} · {template.key}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" aria-label={`Exportar ${template.key}`} onClick={() => download(`modelo-${template.key}.json`, JSON.stringify(template.package, null, 2))}>
                  <Download className="size-4" />
                </Button>
                {!template.builtIn && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Apagar ${template.key}`}
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Apagar este modelo? Obras que já aplicaram continuam iguais.")) return;
                      startTransition(async () => {
                        const result = await deleteSystemTemplateAction(template.id);
                        if (!result.ok) toast.error(result.error);
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            {text(template.description) && <p className="text-sm text-muted-foreground">{text(template.description)}</p>}
            <p className="text-xs text-foreground">Liga: {describePackage(template.package).join(", ") || "só narrativa"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
