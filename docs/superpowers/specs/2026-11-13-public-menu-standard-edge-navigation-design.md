# Navegação nas bordas do cardápio público — design

## Intenção

No cardápio público em apresentação padrão, continuar a navegação na direção do gesto quando as mídias do item acabam. No item inicial, voltar pela mídia ou pelo card retorna à apresentação do restaurante.

## Estado atual

- `PublicMenu` mantém as categorias em ordem e renderiza um `ProductRail` independente para cada categoria.
- Cada card pode ter um trilho de mídia separado. `useMediaRail` limita a posição ao intervalo de mídias e os controles ficam desativados nas bordas.
- O trilho de cards também para no último item de cada categoria.
- `publicExperience` contém o welcome e o cardápio como duas telas horizontais. O link “Ver cardápio” já leva do welcome ao cardápio.
- A apresentação imersiva usa outra navegação e fica fora deste ajuste.

## Decisão

Manter os trilhos, cards e separação por categoria. Usar a sequência pública atual — categorias na ordem exibida, itens na ordem exibida — para resolver o item vizinho quando um gesto chega à borda de mídia ou de cards. Essa abordagem altera menos que achatar as categorias em um trilho único e é mais previsível que depender de encadeamento de scroll do navegador.

## Comportamento

- Dentro das mídias de um item, continuar trocando mídia como hoje.
- Ao avançar além da última mídia, navegar para o próximo item da sequência global; ao voltar antes da primeira, navegar para o item anterior.
- O mesmo avanço entre itens acontece quando o gesto no trilho dos cards chega ao limite da categoria atual.
- Um item sem mídia continua navegável pela área de imagem de fallback e pelo card.
- Ao voltar antes do primeiro item global, rolar `publicExperience` até `restaurant-welcome`.
- No último item global, não circular: avançar permanece no limite.
- Setas e teclado seguem as mesmas fronteiras direcionais. Movimento programático respeita `prefers-reduced-motion`.
- Trocas entre categorias usam o alvo real do card para manter o scroll vertical correto e deixar o `IntersectionObserver` atualizar a categoria ativa.
- Gestos que começam em controles ou no player de vídeo não acionam navegação de card; o trilho de mídia é responsável pelo seu próprio gesto.

## Escopo

- Incluir todos os itens públicos, inclusive indisponíveis, na ordem já retornada pelo menu.
- Aplicar a todos os valores que `parsePublicMenu` normaliza como `standard` (`standard`, `catalog-list` e `catalog-grid`).
- Não alterar `immersive`, dados, links públicos, ordenação de categorias, layout, conteúdo dos cards nem filtros.
- Não adicionar dependências, testes ou executar os comandos proibidos pelo projeto.

## Arquivos previstos

- `features/public-profile/components/public-menu.tsx`: sequência global, navegação entre itens e detecção de gesto de borda em mídia e cards.
- `features/public-profile/components/restaurant-public-profile.tsx`: referência ao contêiner de telas e callback para retornar ao welcome.

## Critérios de aceite

1. Mídias internas continuam avançando normalmente; ultrapassar uma borda muda para o item adjacente na mesma direção.
2. O comportamento atravessa o último item de uma categoria para o primeiro da próxima e vice-versa.
3. No primeiro item global, voltar pela imagem ou pelo card retorna ao welcome; o último item não faz loop.
4. Itens com uma ou nenhuma mídia continuam navegáveis.
5. Setas, teclado e gestos não disputam o mesmo evento; vídeos e botões mantêm seus controles.
6. A apresentação imersiva e o layout atual permanecem inalterados.
7. Movimento reduzido elimina o scroll suave programático.

## Verificação

As instruções do repositório proíbem testes, typecheck, build, lint e Git. A execução futura fica limitada à inspeção estática e revisão manual da matriz de cenários, sem alegar validação em navegador até ela ser permitida.
