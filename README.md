# @venore/plugin-graphic-novels

Plugin do Venore Docks para graphic novels interativas: cada cena é uma lâmina (imagem) com
parágrafos estilo livro, e as escolhas do leitor ramificam a história.

## Fase 1 (esta versão, 0.1.0)

- **Obra → capítulos → cenas**, com texto em vários idiomas (pt-BR, en, es, fr, it, de, ja).
- **Escolhas com variáveis**: cada obra declara variáveis (número ou sim/não); escolhas podem ter
  condições ("só aparece se coragem ≥ 1") e efeitos ("pegou a lanterna = sim"); cenas também
  aplicam efeitos ao entrar.
- **Editor em grafo** (`/admin/graphic-novels/works/:id/chapters/:id`, com @xyflow/react): arrastar
  de uma cena para outra cria uma escolha; painel lateral edita lâmina, texto, final, condições e
  efeitos; validação ao vivo.
- **Publicação com validação**: capítulo sem início, beco sem saída, escolha para outro capítulo,
  variável inexistente etc. impedem publicar. Obra publicada não aceita edição que a quebre.
- **Leitor webtoon** (`/novels/:slug`), mobile-first: feed vertical das cenas visitadas, escolhas no
  fim, "voltar para a última escolha", finais descobertos, seletor de idioma. Progresso no
  navegador sem login; com login, salvo também na conta.
- **Vitrine**: `/novels` e o bloco "Graphic Novels — Vitrine de obras" do page builder.
- Seed "O Farol" (2 capítulos, 4 finais, pt-BR + en).

Cena sem escolhas e que não é final leva ao início do próximo capítulo.

## Próximas fases

- **Fase 2**: autores (usuários comuns) criam obras; publicação passa por aprovação de um admin
  (status `in_review`/`rejected` já existem no schema); elementos interativos na página
  (tocar/revelar/animar/som) e minijogos.
- **Fase 3**: PDF estilo HQ para impressão, em formato livro-jogo ("vá para a página 42");
  doação (plugin `donations`) e capítulos pagos via Mercado Pago.

## Desenvolvimento

Mesmo fluxo dos outros plugins: instalar como dependência `@venore/plugin-graphic-novels` no
checkout do core e rodar `npm run typecheck`, `npm run test:plugins` e (com `TEST_DATABASE_URL`)
os `*.integration.test.ts`. Migrations em `migrations/` (schema `graphic_novels`), geradas com
`drizzle-kit generate` a partir de `database/schema/index.ts`.
