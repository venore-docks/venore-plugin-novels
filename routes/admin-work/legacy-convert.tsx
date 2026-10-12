"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@venore/plugin-sdk/ui";
import { convertLegacyVariablesAction } from "../admin/actions";

// Variáveis do formato antigo (barra com máximo, item de inventário, capacidade) viram recursos e
// itens do catálogo. Sob demanda: o motor continua aceitando o formato antigo até lá.
export function LegacyConvert({ workId, summary }: { workId: string; summary: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Converter variáveis antigas</h2>
        <p className="text-sm text-muted-foreground">{summary} As escolhas e cenas que usam essas variáveis passam a usar o recurso ou o item.</p>
      </div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Converter as variáveis? Os efeitos e condições das cenas são reescritos.")) return;
          startTransition(async () => {
            const result = await convertLegacyVariablesAction(workId);
            if (!result.ok) toast.error(result.error);
            else toast.success("Variáveis convertidas.");
            router.refresh();
          });
        }}
      >
        <ArrowRightLeft className="size-4" />
        Converter
      </Button>
    </section>
  );
}
