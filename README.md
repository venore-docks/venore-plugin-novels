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

## Base de autoria (0.9.0)

- **Catálogo de tags no banco** (Graphic Novels → Tags, permissão `novels.tags.manage`): grupos
  criados pelo admin (nome traduzível, categoria informativa ou de produção, uma ou várias opções,
  obrigatório, aceita tag livre, aparece no card, ordem por arrastar) e tags (nome e descrição
  traduzíveis, endereço único, arquivar sem apagar). Tags livres criadas pelos autores ficam só
  na obra que as usa até o admin **promover**. Os textos dos selos calculados (Interativa / Apenas
  texto / Áudio gerado por IA) também são configuração. As listas fixas da 0.8.0 viraram o
  **pacote inicial** (instalado pela migration `0003`, que converte as tags das obras antigas;
  botão "Instalar pacote inicial" repõe o que foi apagado). Grupo obrigatório sem escolha impede
  publicar. Catálogo público filtra por tag: `/novels?tag=<endereço>`.
- **Seleção de tags** por grupo: chips + "Adicionar…" com busca e teclado (e "Criar" em grupo que
  aceita tag livre); grupo de uma opção com até 4 tags vira botões segmentados.
- **Assistente de criação** (`/admin/novels/new`): Identidade (título grande, subtítulo, sinopse
  com contador, capa arrastada ou da mídia com o ponto do recorte 2:3; endereço em "Avançado"),
  Idiomas, Tags e Revisão, com prévia ao vivo do card (no celular, "Ver prévia") e rascunho salvo
  no navegador. "Criar obra" abre o editor do primeiro capítulo, já com uma cena.
- **Página da obra em abas**: História, Sistema (variáveis), Elenco, Configurações (identidade,
  idiomas, tags), Áudio e Publicação (problemas).
- **Cena em blocos**: Texto (**negrito**, *itálico*), Imagem larga (proporção, de borda a
  borda), Imagem com legenda (texto curto sobre degradê da cor de fundo do site, até 180
  caracteres), Fala (personagem do elenco, cor e retrato), Galeria (2–3 imagens), Separador e
  Imagem de fundo esmaecida (imagem no topo esmaecendo na cor de fundo do tema, texto no
  degradê). Todo texto continua texto: tradução, leitura em voz alta (a fala sai com o nome de
  quem fala) e leitor de tela. A migration `0003` converteu texto + lâmina de cada cena antiga em
  blocos e a `0004` apagou as colunas antigas.
- **Editor de cena em tela cheia** (duplo clique na cena do grafo ou "Escrever a cena"): texto na
  largura de leitura, blocos para adicionar entre quaisquer dois, arrastar pela alça, painel
  lateral recolhível (final, efeitos, escolhas), **Foco** (Ctrl+.; Esc sai), "Ver como o leitor" e
  palavras / tempo de leitura / tempo de áudio no rodapé.
- **Elenco** (aba da obra): nome traduzível, cor de destaque (lista fechada de tokens do tema) e
  retrato; personagem que ainda fala em alguma cena não pode ser removido.

## Painel do personagem (0.7.0)

Cada variável da obra pode aparecer para o leitor ("Mostrar ao leitor" no formulário da obra):

- **Status** (HP, mana, level): fica no **HUD fixo no rodapé** do leitor, que acompanha o texto;
  número com máximo vira barra ("HP 138/150", fica vermelha abaixo de 25%).
- **Habilidade** (club fighting, fist fighting): cartões na aba **Habilidades** da ficha (botão da
  mochila no HUD).
- **Item do inventário**: sim/não = carrega ou não (a clava); número = quantidade (poções). Cada
  item tem **peso** por unidade e aparece num espaço da aba **Mochila**. Uma variável numérica
  marcada como **capacidade da mochila** (peso máximo) não aparece como status: vira "Peso na
  mochila 28,6 de 400" com barra.

Número pode ter **mínimo** e **máximo**, aplicados depois de cada efeito (HP nunca abaixo de 0 nem
acima do teto). O máximo pode ser **outra variável** (`hp_max`, que sobe de nível). Nas condições
das escolhas há dois valores calculados: **Carga do inventário** (`_carga`) e **Espaço livre no
inventário** (`_espaco_livre`) — ex: "Pegar a clava" só aparece com espaço livre ≥ 25. Ao chegar em
cada cena, o leitor vê o que mudou ("HP −12", "Club fighting +1", "Pegou: Clava").

Exemplo (fan fic de Tibia): `hp` (status, mín 0, máx = `hp_max`), `hp_max`, `level` (status), `cap`
(status, capacidade), `club` e `fist` (habilidade), `clava` (item, peso 25). A escolha "Pegar a
clava" tem efeito `clava = sim`; golpes com a clava somam em `club`, socos em `fist`; a cena de
vitória contra o rat soma 1 em `level` e em `hp_max`.

## Leitura em voz alta (exige core 2.3.0 desde a 0.6.0)

O áudio é por ação do autor, no bloco **Áudio** da tela da obra — salvar, publicar ou editar
cenas nunca gera nem refaz áudio:

- **Gerar áudio / Gerar o que falta**: uma faixa por cena e idioma com texto próprio, só para o que
  não tem áudio, falhou ou teve o texto mudado. Vale também para obra em rascunho.
- **Gerar tudo de novo**: refaz todas as faixas (ex: depois de trocar a voz).
- **Apagar áudio**: remove todas; o botão de ouvir some do leitor.

O bloco mostra a produção (faixas em dia, desatualizadas, faltando, na fila, o percentual da faixa
em geração) e o que o worker do core está fazendo, e se atualiza sozinho enquanto há fila. Texto
mudado fica como **desatualizado**: o áudio antigo continua tocando até o autor gerar de novo. A
obra aparece com título e link em Editorial → Áudios no core. No leitor, cada cena com áudio tem
**Ouvir** e o modo **Ler em voz alta** (alto-falante no topo, ou a opção na capa) toca cada cena
nova ao avançar. Apagar a obra apaga o áudio; despublicar mantém. API: `@venore/plugin-sdk/speech`
(scope `novels.work:<id>`); configuração no core: `docs/speech/leitura-em-voz-alta.md`.

## Próximas fases

- **Fase 2**: autores (usuários comuns) criam obras; publicação passa por aprovação de um admin
  (status `in_review`/`rejected` já existem no schema); elementos interativos na página
  (tocar/revelar/animar/som) e minijogos.
- **Fase 3**: PDF estilo HQ para impressão, em formato livro-jogo ("vá para a página 42");
  doação (plugin `donations`) e capítulos pagos via Mercado Pago.

## Desenvolvimento

O core deriva a chave do plugin do **nome do pacote** (`@venore/plugin-novels` → `novels`) e
procura `novelsManifest`, `novelsRouteTable` e `novelsContributions`
(`scripts/gen-plugin-registry.ts`). A chave do manifesto, as permissions (`novels.works.manage`,
`novels.tags.manage`),
o admin (`/admin/novels`) e o schema Postgres (`novels`, tracking em `novels_migrations`) seguem a
mesma chave — renomear o pacote exige renomear tudo isso junto.

Mesmo fluxo dos outros plugins: instalar como dependência `@venore/plugin-novels` no checkout do
core e rodar `npm run typecheck` e `npm run test:plugins` (usa o repo-irmão `../venore-plugin-novels`
quando existe). O `*.integration.test.ts` precisa de `TEST_DATABASE_URL` e não entra em nenhuma
config do core (a de integração só inclui `src/**`); rodar com uma config local que inclua
`../venore-plugin-novels/**/*.integration.test.ts`. Migrations em `migrations/` (schema `novels`),
geradas com `drizzle-kit generate` a partir de `database/schema/index.ts`.
