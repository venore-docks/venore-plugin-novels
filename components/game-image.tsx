import { cn } from "@venore/plugin-sdk/ui";

// Imagem de item, criatura, vocação ou verbete; sem imagem, um cartão com as iniciais e o nome
// (mockup), para a grade nunca ficar com buracos.
export function GameImage({ url, name, className, compact = false }: { url: string | null | undefined; name: string; className?: string; compact?: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cn("rounded-md object-cover", className)} />;
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-md border border-border bg-gradient-to-br from-muted to-accent/14 text-center",
        className,
      )}
    >
      <span className={cn("font-display font-bold leading-none text-muted-foreground", compact ? "text-sm" : "text-2xl")}>{initials || "?"}</span>
      {!compact && <span className="mt-1 line-clamp-2 px-1 text-[0.65rem] leading-tight text-muted-foreground">{name}</span>}
    </span>
  );
}
