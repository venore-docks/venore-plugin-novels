import { BookOpen } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";

// Capa em proporção de livro (2:3). Sem capa, um bloco neutro com ícone.
export function WorkCover({ url, title, className }: { url: string | null; title: string; className?: string }) {
  if (!url) {
    return (
      <div className={cn("flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-muted text-muted-foreground", className)}>
        <BookOpen className="size-8" strokeWidth={1.5} aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={title} loading="lazy" className={cn("aspect-[2/3] w-full rounded-lg object-cover", className)} />
  );
}
