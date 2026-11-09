# Empty state da busca de restaurantes — Especificação de design

## Objetivo

Trocar o vazio genérico da busca na home por uma resposta útil, visualmente cuidada e compacta. O estado precisa orientar a próxima tentativa e caber abaixo do campo em uma janela baixa como a captura fornecida, sem cobrir o título da página.

## Problemas observados

- O estado atual centraliza apenas “Nenhum restaurante encontrado.” dentro de um painel alto e sem hierarquia.
- O texto é igual para uma busca sem correspondência e para a lista inicial sem restaurantes ativos.
- Na captura de referência, o espaço vertical abaixo do campo é menor que o popover atual. O posicionador o vira para cima e a superfície cobre parte do título da home.
- A busca aceita nome, cozinha e endereço, mas o vazio não sugere como refinar a consulta.

## Estados e conteúdo

### Busca sem correspondência

- Título contextual: `Sem resultados para “{consulta}”`, preservando o valor completo para acessibilidade e limitando visualmente consultas longas.
- Apoio: `Tente outro nome, cozinha ou endereço.`
- O botão `Limpar busca` já disponível no campo continua sendo a ação para recomeçar; não duplicar um botão dentro da região de status.

### Nenhum restaurante ativo

- Título: `Ainda não há restaurantes ativos.`
- Apoio: `Os restaurantes ativos aparecerão aqui.`
- Não sugerir que os cardápios precisam estar publicados.

Carregamento, erro e resultados existentes mantêm os estados atuais. Não mostrar vazio antes de a busca terminar.

## Direção de arte

- Composição horizontal compacta: medalhão de ícone à esquerda e título mais apoio alinhados à direita.
- Altura alvo do conteúdo: aproximadamente 56–64 px; superfície completa do popover: aproximadamente 72–80 px.
- Ícone principal `SearchX`, em superfície suavemente tonalizada com os tokens existentes. `Utensils` e `MapPin` aparecem como pequenos detalhes em medalhões discretos, sem competir com o texto.
- Reutilizar borda, superfície e cor semântica da Combobox e dos temas claro/escuro. Sem ilustração raster, novas cores hard-coded ou novas dependências.
- O texto de apoio precisa continuar legível em largura móvel; consultas longas não podem expandir a altura nem criar rolagem horizontal.

## Movimento e acessibilidade

- Ao entrar no estado vazio, revelar o medalhão em uma única transição de opacidade e escala suave, aproximadamente 180–220 ms. Os dois detalhes de ícone entram em sequência curta, com deslocamento máximo de 3–4 px.
- Não usar rotação contínua, bounce, pulso infinito, shimmer ou animação que pareça carregamento. A busca concluída precisa parecer estável.
- `prefers-reduced-motion` deixa os ícones diretamente no estado final, sem deslocamento nem animação.
- Ícones decorativos usam `aria-hidden`. O elemento Base UI `ComboboxEmpty` com `role=status` permanece montado enquanto o popover está aberto; seu conteúdo muda conforme o estado. O anúncio existente de contagem não deve duplicar a mensagem quando não há restaurantes.
- A animação não bloqueia interação nem muda a altura do painel durante a entrada.

## Comportamento responsivo e escopo

- O painel compacto deve caber abaixo do campo na captura de viewport baixo; manter o alinhamento com a âncora e não cobrir a marca ou o título nessa condição.
- Se o posicionador ainda inverter a posição por falta de espaço, ajustar a posição apenas da busca pública, sem mudar as demais Comboboxes do produto.
- Alterar somente o estado vazio da busca e o estilo local necessário. Não alterar rota, consulta, debounce, resultados, home fora da área da busca, onboarding ou Comboboxes compartilhadas.

## Critérios de aceite

- Busca sem resultados mostra o termo pesquisado e uma orientação que cita nome, cozinha e endereço.
- Lista inicial vazia usa mensagem distinta sem associar restaurantes à publicação de cardápio.
- O painel visual é horizontal e compacto, com `SearchX`, pequenos ícones de utensílios/localização e tokens existentes.
- A captura em janela baixa não exibe o popover sobre o título da home.
- A entrada é curta e única, não parece carregamento, não causa salto de layout e respeita movimento reduzido.
- Os ícones são decorativos para leitor de tela; o estado é anunciado uma vez, sem duplicar “0 restaurantes encontrados”.
- Estados de carregamento, erro, resultados e a ação de limpar busca continuam funcionando como antes.

## Restrições do projeto

Não executar nem adicionar testes. Os comandos `git`, `typecheck`, `build` e `lint` também são proibidos. Fazer somente revisão estática do código; não aplicar comandos de banco.
