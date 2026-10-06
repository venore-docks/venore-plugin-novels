# @venore/plugin-novels

Plugin do Venore Docks para graphic novels interativas: cada cena é uma lâmina (imagem) com
parágrafos estilo livro, e as escolhas do leitor ramificam a história.

## Fase 1 (0.1.x; 0.2.0 só renomeia a chave para `novels`)

- **Obra → capítulos → cenas**, com texto em vários idiomas (pt-BR, en, es, fr, it, de, ja).
- **Escolhas com variáveis**: cada obra declara variáveis (número ou sim/não); escolhas podem ter
  condições ("só aparece se coragem ≥ 1") e efeitos ("pegou a lanterna = sim"); cenas também
  aplicam efeitos ao entrar.
- **Editor em grafo** (`/admin/novels/works/:id/chapters/:id`, com @xyflow/react): arrastar
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

## Leitura em voz alta (0.3.0+, exige core 2.1.0)

O autor escolhe por obra: **"Gerar áudio (leitura em voz alta)"** no formulário da obra
(desligado por padrão; 0.4.0). Ligado, depois de publicada, cada cena ganha uma faixa em cada
idioma com texto próprio. O bloco **Áudio** da tela da obra (0.5.0, exige core 2.2.0) mostra a
produção: barra com as faixas prontas e o trecho da faixa em geração, o que está na fila, falhas e
o que o worker do core está fazendo (preparando as vozes, gerando, parado), e se atualiza sozinho
enquanto há fila; a obra aparece com título e link em Editorial → Áudios no core. No leitor, cada
cena tem **Ouvir** e o modo **Ler em voz alta** (alto-falante no topo, ou a opção na capa) toca
cada cena nova ao avançar. O áudio vem de `@venore/plugin-sdk/speech` (scope `novels.work:<id>`);
o core só gera o que é novo ou mudou. Desligar a opção ou apagar a obra remove o áudio;
despublicar mantém (republicar sem mudança não gera de novo). Configuração no core:
`docs/speech/leitura-em-voz-alta.md`.

## Próximas fases

- **Fase 2**: autores (usuários comuns) criam obras; publicação passa por aprovação de um admin
  (status `in_review`/`rejected` já existem no schema); elementos interativos na página
  (tocar/revelar/animar/som) e minijogos.
- **Fase 3**: PDF estilo HQ para impressão, em formato livro-jogo ("vá para a página 42");
  doação (plugin `donations`) e capítulos pagos via Mercado Pago.

## Desenvolvimento

O core deriva a chave do plugin do **nome do pacote** (`@venore/plugin-novels` → `novels`) e
procura `novelsManifest`, `novelsRouteTable` e `novelsContributions`
(`scripts/gen-plugin-registry.ts`). A chave do manifesto, a permission (`novels.works.manage`),
o admin (`/admin/novels`) e o schema Postgres (`novels`, tracking em `novels_migrations`) seguem a
mesma chave — renomear o pacote exige renomear tudo isso junto.

Mesmo fluxo dos outros plugins: instalar como dependência `@venore/plugin-novels` no checkout do
core e rodar `npm run typecheck` e `npm run test:plugins` (usa o repo-irmão `../venore-plugin-novels`
quando existe). O `*.integration.test.ts` precisa de `TEST_DATABASE_URL` e não entra em nenhuma
config do core (a de integração só inclui `src/**`); rodar com uma config local que inclua
`../venore-plugin-novels/**/*.integration.test.ts`. Migrations em `migrations/` (schema `novels`),
geradas com `drizzle-kit generate` a partir de `database/schema/index.ts`.
