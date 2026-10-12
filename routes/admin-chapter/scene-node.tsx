"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ImageOff } from "lucide-react";
import { Badge, cn } from "@venore/plugin-sdk/ui";

export type SceneNodeData = {
  label: string;
  excerpt: string;
  imageUrl: string | null;
  isStart: boolean;
  isEnding: boolean;
  hasError: boolean;
  // Nenhuma escolha leva até ela (validador).
  unreachable: boolean;
  // % das partidas da última simulação que passaram por ela (null = sem simulação).
  coverage: number | null;
  // Duplo clique abre o editor da cena (o onNodeDoubleClick do xyflow perde o evento quando o
  // primeiro clique re-renderiza a seleção).
  onOpen: () => void;
};

export type SceneFlowNode = Node<SceneNodeData, "scene">;

export function SceneNode({ data, selected }: NodeProps<SceneFlowNode>) {
  return (
    <div
      onDoubleClick={data.onOpen}
      className={cn(
        "w-48 overflow-hidden rounded-lg border bg-card text-left shadow-sm",
        selected ? "border-primary" : data.hasError ? "border-destructive" : data.unreachable ? "border-dashed border-warning-border" : "border-border",
        data.unreachable && "opacity-75",
      )}
    >
      <Handle type="target" position={Position.Top} />
      {data.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.imageUrl} alt="" className="h-20 w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-12 w-full items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="size-4" aria-hidden />
        </div>
      )}
      <div className="space-y-1 p-2">
        <div className="flex flex-wrap gap-1">
          {data.isStart && <Badge>Início</Badge>}
          {data.isEnding && <Badge variant="secondary">Final</Badge>}
          {data.unreachable && (
            <Badge variant="outline" className="border-warning-border text-warning">
              Inalcançável
            </Badge>
          )}
          {data.coverage !== null && (
            <Badge variant="outline" title="Partidas da última simulação que passaram aqui" className={cn(data.coverage === 0 && "text-destructive")}>
              {data.coverage}% sim.
            </Badge>
          )}
        </div>
        <p className="truncate text-sm font-medium text-foreground">{data.label || "Cena sem nome"}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{data.excerpt || "Sem texto"}</p>
      </div>
      {!data.isEnding && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
