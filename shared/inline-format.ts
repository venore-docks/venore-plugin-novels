// Formatação leve do texto das cenas: **negrito** e *itálico*, parágrafos por linha em branco.
// Sem HTML: o texto do autor nunca vira markup cru (o leitor monta os nós a partir dos trechos).

export type InlineSegment = { text: string; bold: boolean; italic: boolean };

const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index), bold: false, italic: false });
    const token = match[0];
    if (token.startsWith("**")) segments.push({ text: token.slice(2, -2), bold: true, italic: false });
    else segments.push({ text: token.slice(1, -1), bold: false, italic: true });
    last = index + token.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false, italic: false });
  return segments;
}

// Texto sem as marcas, para a leitura em voz alta e para trechos (prévia no grafo).
export function stripInline(text: string): string {
  return text.replace(TOKEN, (token) => (token.startsWith("**") ? token.slice(2, -2) : token.slice(1, -1)));
}
