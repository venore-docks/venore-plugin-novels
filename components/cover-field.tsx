"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn, MediaPickerField, uploadMediaForPickerAction, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { CoverFocus } from "../contracts/types";

const DIRECT_UPLOAD_MAX = 4 * 1024 * 1024;

// Capa da obra: arrastar uma imagem (ou clicar) envia para a biblioteca de mídia; "Escolher da
// mídia" abre o seletor do core. Clicar na imagem escolhe o ponto que fica no recorte 2:3.
export function CoverField({
  media,
  focus,
  onMedia,
  onFocus,
  className,
}: {
  media: PickableMedia | null;
  focus: CoverFocus | null;
  onMedia: (media: PickableMedia | null) => void;
  onFocus: (focus: CoverFocus) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<{ uploading: boolean; error: string | null }>({ uploading: false, error: null });

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ uploading: false, error: "Escolha um arquivo de imagem." });
      return;
    }
    if (file.size > DIRECT_UPLOAD_MAX) {
      setStatus({ uploading: false, error: "Imagem grande demais para arrastar (até 4 MB). Use \"Escolher da mídia\" para enviar." });
      return;
    }
    setStatus({ uploading: true, error: null });
    const result = await uploadMediaForPickerAction({ filename: file.name, contentType: file.type, size: file.size, data: await file.arrayBuffer() });
    if (!result.success) {
      setStatus({ uploading: false, error: result.error.message });
      return;
    }
    setStatus({ uploading: false, error: null });
    onMedia(result.data);
    onFocus({ x: 50, y: 50 });
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void upload(event.dataTransfer.files[0]);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {media ? (
        <div className="space-y-2">
          <button
            type="button"
            className="relative block w-full cursor-crosshair overflow-hidden rounded-xl bg-muted"
            aria-label="Escolher o ponto da capa que aparece no recorte"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              onFocus({
                x: Math.round(((event.clientX - box.left) / box.width) * 100),
                y: Math.round(((event.clientY - box.top) / box.height) * 100),
              });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.url} alt="" className="block max-h-80 w-full object-contain" draggable={false} />
            <span
              aria-hidden
              className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-foreground bg-primary/60 shadow"
              style={{ left: `${focus?.x ?? 50}%`, top: `${focus?.y ?? 50}%` }}
            />
          </button>
          <p className="text-xs text-muted-foreground">Clique na imagem para escolher o centro do recorte 2:3.</p>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex aspect-[2/3] max-h-96 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            over ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:border-ring",
          )}
        >
          {status.uploading ? <Loader2 className="size-8 animate-spin text-muted-foreground" /> : <ImagePlus className="size-8 text-muted-foreground" />}
          <p className="text-sm font-medium text-foreground">{status.uploading ? "Enviando…" : "Arraste a capa aqui"}</p>
          <p className="text-xs text-muted-foreground">ou clique para escolher um arquivo (proporção de livro, 2:3)</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
      {status.error && <p className="text-xs text-destructive">{status.error}</p>}
      <MediaPickerField
        key={media?.id ?? "vazio"}
        name="coverMediaId"
        label="Ou escolha da biblioteca de mídia"
        initialMedia={media}
        onSelect={(picked) => {
          onMedia(picked);
          if (picked) onFocus({ x: 50, y: 50 });
        }}
      />
    </div>
  );
}
