"use client";

import { useMemo, useSyncExternalStore } from "react";

// Última simulação de balanceamento da obra (% de partidas que passaram por cada cena), guardada
// no navegador do autor para o grafo do capítulo mostrar. Conveniência local: some sem problema.

const storageKey = (workId: string) => `novels-sim:${workId}`;

export function saveCoverage(workId: string, coverage: Record<string, number>) {
  try {
    localStorage.setItem(storageKey(workId), JSON.stringify(coverage));
  } catch {
    // navegador sem armazenamento: o grafo só não mostra a cobertura
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export function useCoverage(workId: string): Record<string, number> | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey(workId));
      } catch {
        return null;
      }
    },
    () => null,
  );
  return useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as Record<string, number>) : null;
    } catch {
      return null;
    }
  }, [raw]);
}
