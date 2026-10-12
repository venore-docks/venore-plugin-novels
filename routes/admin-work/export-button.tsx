"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@venore/plugin-sdk/ui";
import { exportWorkAction } from "../admin/actions";

// Baixa a obra como pacote venore-novels-work (Importar obra, em qualquer instalação).
export function ExportButton({ workId }: { workId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await exportWorkAction(workId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          const url = URL.createObjectURL(new Blob([result.content], { type: "application/json" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = result.fileName;
          link.click();
          URL.revokeObjectURL(url);
          toast.success("Obra exportada (sem imagens).");
        })
      }
    >
      <Download className="size-4" />
      {pending ? "Exportando..." : "Exportar"}
    </Button>
  );
}
