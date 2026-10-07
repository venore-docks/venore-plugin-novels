"use client";

import { useState, type DragEvent } from "react";

// Reordenar uma lista arrastando (HTML5 drag and drop) ou com setas (teclado/celular). A ordem
// local muda na hora; `onCommit` recebe a ordem final para gravar.
export function useDragReorder(ids: string[], onCommit: (orderedIds: string[]) => void) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const order = preview ?? ids;

  const move = (list: string[], id: string, to: number) => {
    const next = list.filter((item) => item !== id);
    next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
    return next;
  };

  const handleProps = (id: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      setDragging(id);
      setPreview(ids);
    },
    onDragEnd: () => {
      setDragging(null);
      setPreview(null);
    },
  });
  const targetProps = (id: string) => ({
    onDragOver: (event: DragEvent) => {
      if (!dragging || dragging === id) return;
      event.preventDefault();
      setPreview((current) => move(current ?? ids, dragging, (current ?? ids).indexOf(id)));
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (preview && preview.join() !== ids.join()) onCommit(preview);
      setDragging(null);
      setPreview(null);
    },
  });

  return {
    order,
    dragging,
    // Item que contém campos de texto: só a alça arrasta (senão selecionar texto vira arrastar).
    handleProps,
    targetProps,
    itemProps: (id: string) => ({
      draggable: true,
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
        setDragging(id);
        setPreview(ids);
      },
      onDragOver: (event: DragEvent) => {
        if (!dragging || dragging === id) return;
        event.preventDefault();
        setPreview((current) => move(current ?? ids, dragging, (current ?? ids).indexOf(id)));
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (preview && preview.join() !== ids.join()) onCommit(preview);
        setDragging(null);
        setPreview(null);
      },
      onDragEnd: () => {
        setDragging(null);
        setPreview(null);
      },
    }),
    moveBy: (id: string, delta: number) => {
      const index = ids.indexOf(id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= ids.length) return;
      onCommit(move(ids, id, target));
    },
  };
}
