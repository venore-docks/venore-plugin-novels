# Pacote de obra (`venore-novels-work`)

Uma história inteira num arquivo JSON: importa em **Graphic Novels → Importar obra** (vira um
rascunho novo, com ids novos) e sai de qualquer obra pelo botão **Exportar** da obra. Os arquivos
desta pasta são as histórias de exemplo, uma por tipo de obra, oferecidas na tela de importação.

Tipos (campo `kind`): `narrative` (só narrativa) e os modelos de sistema embutidos
(`aventura_simples`, `rpg_fantasia`, `venore_padrao`, `tibia_like`, `terror_sanidade`).

## Regras gerais

- Tudo é referenciado por **chave legível**, nunca por id do banco:
  - cena: a `key` da cena (única na obra inteira, `[a-z0-9][a-z0-9_-]*`);
  - item / criatura: a `key` do catálogo (`[a-z][a-z0-9_]*`);
  - personagem do elenco (bloco de fala): a `key` dele em `castId`.
  Os campos que levam cena: `targetSceneId`, `sceneId` (gatilho de recurso), `victorySceneId`,
  `defeatSceneId`, `fleeSceneId`. Os que levam item: `itemId`; criatura: `creatureId`.
- Ids internos do sistema (efeito com duração, missão, conquista, verbete, vocação) são os
  próprios `id` definidos em `system`, sem troca.
- **Imagens não viajam** (o id de mídia é da instalação): qualquer `mediaId`/`imageMediaId` vira
  `null` e bloco de galeria some. Item, criatura, vocação e verbete sem imagem aparecem como um
  cartão com o nome. Use blocos `text`, `speech` e `divider`.
- Texto é `LocalizedText`: `{ "pt-BR": "..." }` (mais idiomas se `work.locales` tiver).
- Texto com ficha: `{nome}` põe o nome; `{sexo|feminino:cansada|masculino:cansado|cansade}` escolhe
  pelo valor (o último sem `:` é o padrão). Só vale com o módulo `character` e os campos na ficha.

## Estrutura

```jsonc
{
  "format": "venore-novels-work",
  "version": 1,
  "kind": "rpg_fantasia",
  "work": { "slug": "a-torre", "title": { "pt-BR": "A Torre" }, "subtitle": {}, "synopsis": {},
            "defaultLocale": "pt-BR", "locales": ["pt-BR"], "tags": [] },
  "variables": [],             // VariableDefinition (formato antigo; prefira o sistema)
  "system": { ... },           // GameSystem (contracts/game.ts); null = só narrativa
  "cast": [{ "key": "mestre", "name": { "pt-BR": "Mestre Ivo" }, "color": "chart-2" }],
  "items": [ ... ],            // Item sem id/position (contracts/game.ts)
  "creatures": [ ... ],        // Creature sem id/position
  "chapters": [
    {
      "key": "cap1",
      "title": { "pt-BR": "A chegada" },
      "start": "chegada",
      "scenes": [
        { "key": "chegada", "label": "Chegada",
          "text": { "pt-BR": "Atalho para um bloco de texto." },
          "blocks": [ { "type": "speech", "castId": "mestre", "text": { "pt-BR": "Bem-vindo." } } ],
          "effects": [], "mechanics": { "kind": "text" } },
        { "key": "fim_bom", "label": "Final bom", "text": { "pt-BR": "..." },
          "isEnding": true, "endingTitle": { "pt-BR": "A luz volta" } }
      ],
      "choices": [
        { "from": "chegada", "to": "fim_bom", "label": { "pt-BR": "Entrar" },
          "conditions": [], "effects": [], "mechanics": {} }
      ]
    }
  ]
}
```

`x`/`y` na cena são a posição no grafo; sem eles, o importador distribui em camadas.

## Como a leitura anda

- Cena com escolhas: o leitor escolhe (as que não passam nas condições somem ou ficam
  desabilitadas, conforme `mechanics.whenUnavailable`). **Toda cena com escolhas condicionais
  precisa de pelo menos uma escolha sempre disponível**, senão a partida empaca.
- Cena **sem escolhas e sem `isEnding`**: fim do capítulo, vai para a cena `start` do próximo.
  Escolha nunca liga cenas de capítulos diferentes.
- Cena com `isEnding: true` é um final (com `endingTitle`); não pode ter escolhas.
- Cena de encontro (`mechanics.kind = "encounter"`): a luta começa ao entrar. Vitória vai para
  `victorySceneId` (sem ele, fica na cena e mostra as escolhas dela); derrota para
  `defeatSceneId` (sem ele, vale o gatilho "ao zerar" do recurso de vida); fuga para
  `fleeSceneId` (sem ele, fugir fica desligado).
- Cena de loja (`mechanics.kind = "shop"`): mostra a loja junto com as escolhas da cena.

## Efeitos (`effects` de cena, escolha, item, gatilho, nível)

```jsonc
{ "kind": "formula", "target": "hp", "operation": "add", "formula": "-1d6" }   // ou "set"
{ "kind": "restore", "target": "hp" }                                         // enche até o máximo
{ "kind": "item", "operation": "give", "itemId": "tocha", "quantity": "1" }   // give | take | set
{ "kind": "lose_random_item", "quantity": "1" }
{ "kind": "unlock", "entryId": "vila_cinza" }                                 // verbete da enciclopédia
{ "kind": "equip", "itemId": "elmo" }  { "kind": "unequip", "itemId": "elmo" }
{ "kind": "loot", "entries": [{ "itemId": "moeda", "chance": 50, "quantity": "1d10" }] }
{ "kind": "xp", "amount": "50" }
{ "kind": "status", "operation": "apply", "effectId": "envenenado" }          // apply | remove
{ "kind": "quest", "operation": "start", "questId": "o_selo" }                // start | advance | complete | fail
{ "kind": "achievement", "achievementId": "sem_medo" }
{ "variable": "coragem", "operation": "add", "value": 1 }                     // formato antigo (variables)
```

`target` de fórmula: chave de recurso, atributo, `xp`/nível/pontos da progressão, moeda contador ou
variável numérica.

## Condições (`conditions` da escolha)

```jsonc
{ "kind": "formula", "formula": "forca >= 12 e tem(\"chave\") > 0" }
{ "kind": "item", "itemId": "chave", "min": 1 }
{ "kind": "equipped", "itemId": "amuleto" }
{ "kind": "fits", "itemId": "bau" }
{ "kind": "quest", "questId": "o_selo", "state": "active" }   // not_started | active | done | failed
{ "kind": "profile", "field": "sexo", "value": "feminino" }
{ "kind": "achievement", "achievementId": "sem_medo" }
{ "kind": "status", "effectId": "abencoado" }
{ "variable": "coragem", "operator": "gte", "value": 2 }      // formato antigo
```

## Mecânica da escolha (`mechanics`)

```jsonc
{
  "cost": [{ "resource": "mana", "amount": "5" }],
  "whenUnavailable": "disable",                 // ou "hide"
  "test": {                                     // null = sem teste
    "roll": "1d20 + destreza", "dc": "14", "label": { "pt-BR": "Destreza" },
    "successEffects": [],                       // sucesso vai para o `to` da escolha
    "failure": { "targetSceneId": "caiu", "effects": [{ "kind": "formula", "target": "hp", "operation": "add", "formula": "-3" }] },
    "critical": null, "fumble": null,           // { targetSceneId, effects } com 20/1 natural
    "bands": []                                 // faixas no lugar de passa/falha: { min, max, targetSceneId, effects }
  }
}
```

O destino da falha precisa ser uma cena do mesmo capítulo.

## Mecânica da cena (`mechanics`)

```jsonc
{
  "kind": "encounter",                          // text | encounter | shop
  "onZero": { "hp": "morte_no_poco" },          // gatilho só nesta cena (recurso → cena)
  "noRegen": false,
  "encounter": {
    "creatures": [{ "creatureId": "lobo", "count": 2 }],
    "mode": "rounds",                           // ou "single" (um teste resolve)
    "victorySceneId": "clareira", "defeatSceneId": null, "fleeSceneId": "fuga",
    "single": { "roll": "1d20 + forca", "dc": "12", "hpLoss": "1d6" },
    "messages": { "playerHit": { "pt-BR": "{atacante} acerta {alvo}: {dano}." } }
  },
  "shop": { "items": [{ "itemId": "pocao_vida", "price": 10, "stock": 3 }], "sellRate": 0.5 }
}
```

Eventos das frases de combate: `playerHit`, `playerMiss`, `enemyHit`, `enemyMiss`, `critical`,
`victory`, `defeat`, `flee`.

## Fórmulas

`+ - * / % ^`, comparações (`= != > >= < <=`), `e`/`ou`/`não`, `min max arred piso teto abs
limitar se`, dados `1d20`, `2d20k1`, `4d6k3`; da partida: `tem("item")`, `equipado("item")`,
`cabe("item")`, `perfil("sexo")`, `missao("id") = "ativa"`, `etapa("id")`, `conquista("id")`,
`efeito("id")`, `soma_modificadores("atributo")`, `equipado.area`, `equipado.area.atributo`; chaves
de recurso (`hp`, `hp.max`), atributo (`forca`, `forca.base`), derivado, nível, XP, moeda.
No combate: `dado`, `atacante.<chave>`, `defensor.<chave>`.

## Conferir um pacote

```sh
# a partir do repositório do plugin, com node_modules do core ligado
npx tsx scripts/check-work-package.ts examples/a-torre.json 300
# esqueleto com o sistema, itens e criaturas de um modelo
npx tsx scripts/template-skeleton.ts rpg_fantasia /tmp/esqueleto.json
```

Mostra erros de formato, o validador de publicação (erros e avisos) e o simulador jogando com
cada estratégia (finais alcançados, onde empaca, onde o recurso zera, cenas nunca visitadas).
