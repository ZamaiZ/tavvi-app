# Perfil público do restaurante — Especificação de design

## Objetivo

Exibir em `/{slug}` a apresentação pública de todo restaurante ativo, mesmo quando ainda não existe cardápio publicado. A página usa a identidade escolhida no onboarding e reúne as informações públicas disponíveis sobre o restaurante.

## Público e contexto

A pessoa chega pelo link público do restaurante, por QR Code ou por NFC. Ela precisa reconhecer a casa, encontrar um canal de contato ou endereço e entender que o cardápio ainda está sendo preparado.

## Regras de publicação e acesso

- Somente restaurantes existentes com `status = active` podem ser exibidos. O schema atual não implementa exclusão lógica.
- Slugs inválidos, inexistentes ou associados a restaurantes `draft` ou `suspended` resultam na mesma experiência 404, sem revelar qual condição ocorreu.
- A ativação do restaurante não depende da publicação do cardápio. O perfil permanece acessível enquanto o cardápio é preparado.
- A página não consulta categorias, pratos, preços ou itens de rascunho.
- A rota usa o host público atual e um segmento `/{slug}`. A home `/` e as superfícies estáticas de Admin/Painel permanecem intactas.
- `admin` e `painel` são segmentos reservados às rotas estáticas da aplicação. A geração e a edição de slugs recusam esses valores; a geração automática usa o sufixo `-restaurante`. Registros existentes não são renomeados automaticamente.

## Conteúdo

Mostrar apenas os dados existentes e válidos:

- Nome público, descrição e segmento quando preenchidos.
- Logo e capa opcionais.
- Telefone, WhatsApp, Instagram, endereço e link do Maps.
- Link direto para avaliação no Google quando estiver salvo e válido.
- Estado do cardápio em preparação, sem itens, categorias, preços, datas prometidas ou horários inventados.

Os canais usam destinos adequados: `tel:` para telefone, `wa.me` para WhatsApp, perfil do Instagram e o link de Maps informado ou uma busca construída a partir do endereço. Links externos usam abertura segura e rótulos acessíveis. Campos ausentes ou inválidos não geram controles vazios.

O Tavvi-app ainda não possui fluxo de feedback público. Esta entrega não mostra CTA de feedback nem implementa envio, armazenamento ou moderação de feedback.

## Direção visual

A página segue a apresentação `catalog` do Tavvi original: faixa de capa, conteúdo sobreposto à base da capa, ícones circulares de contato, controle de aparência e lista de ações com ícone, rótulo e affordance no mesmo padrão. Não reutilizar a navegação por telas do cardápio nem trazer conteúdo de feedback.

A faixa de capa usa `clamp(170px, 27vw, 300px)` no desktop e `clamp(160px, 48vw, 220px)` até 767px, evitando que a imagem domine a tela móvel. A linha de identidade mantém logo à esquerda e segmento/nome à direita, sobrepondo a base da capa. A borda do logo acompanha a base do tema claro ou escuro e a imagem usa `object-fit: contain`.

A descrição fica abaixo de toda a linha de identidade, alinhada ao início do logo e ocupando a largura disponível. O armazenamento e formulário mantêm o limite atual de 500 caracteres. No perfil, mostrar inicialmente até 180 caracteres em um limite de palavra e oferecer “Exibir mais”/“Exibir menos” somente quando necessário.

A linha de contato segue a ordem e o tratamento do original: ligar, WhatsApp, Instagram e mapa, quando cada dado válido existir; ao lado fica o toggle circular de aparência. O endereço formatado vem abaixo. A lista de ações mostra avaliação no Google quando houver link válido e sempre informa “Cardápio em construção” quando ainda não há cardápio, sem apresentar itens, categorias, preços ou interação falsa.

No desktop, o conteúdo usa largura controlada; no celular, conserva os alvos circulares de 44px e ações de largura total, sem rolagem horizontal. O desenho usa os tokens e fontes do tema selecionado, com acabamento coerente nos dois modos de aparência.

## Temas e tipografia

- Usar os oito presets já presentes no onboarding: Brasa, Forno, Grão, Sal, Horta, Neon, Nori e Confeito.
- O preset determina a dupla de fontes, proporções e raios visuais já estabelecidos no Tavvi original: Anton/Inter, Bitter/Inter, Fraunces/Inter, Cormorant Garamond/Inter, Outfit/Outfit, Space Grotesk/Space Grotesk, Zen Kaku Gothic New/Inter e Quicksand/Quicksand.
- Aplicar as cores base e de destaque salvas no restaurante. Quando estiverem ausentes ou inválidas, usar os valores do preset. Derivar tinta, texto sobre destaque, contornos e tons escuros com contraste adequado; o tema nunca pode tornar texto ou controles ilegíveis.
- O toggle exclusivo do perfil percorre `system → light → dark → system`, persiste em `localStorage["tema-cardapio"]` e aplica `data-menu-appearance` ao elemento raiz, como no Tavvi original. A apresentação não chama nem altera o `ThemeProvider` global; CSS do perfil isolado define a aparência escolhida ou segue `prefers-color-scheme` em modo `system`.
- `Ctrl+Alt+T` aciona o mesmo ciclo de aparência quando o foco está no perfil público e não altera o tema global do app.
- Os estilos ficam limitados à raiz do perfil. Não importar CSS do Tavvi original nem mudar tokens globais de Admin/Painel.

## Movimento e acessibilidade

- Entrada curta e sequencial para cada elemento visível — identidade, descrição, ícones, toggle, endereço e ações — com transições CSS leves e curva de desaceleração.
- Interações usam transições curtas de cor e deslocamento; nada bloqueia toques ou teclado.
- `prefers-reduced-motion` remove deslocamentos e efeitos não essenciais.
- Ícones decorativos são ocultos da árvore acessível; botões de ícone têm nome acessível, anel de foco visível e alvo mínimo de 44 px.
- Texto normal mantém contraste WCAG AA, imagens têm dimensões reservadas e comportamento responsivo.

## Segurança e dados

- A página usa DAL server-only e recebe um DTO público mínimo.
- Não conceder leitura anônima da tabela `restaurants`; consultar uma função RPC `SECURITY DEFINER` com `search_path` vazio, slug validado, filtro de status ativo e retorno limitado aos campos públicos necessários. A remoção física do registro faz a busca não retornar perfil.
- O cliente Supabase público usa somente a publishable key e não reutiliza cookies de sessão do Admin/Painel. Nunca usar `service_role`.
- Logo e capa são servidas por rota interna baseada em slug e slot (`logo` ou `cover`). A rota resolve somente os caminhos gravados no perfil ativo e usa a policy anônima do bucket como barreira adicional. Caminhos de storage não são aceitos diretamente do visitante nem incluídos no HTML.
- A policy do bucket permite leitura anônima somente do logo/capa atualmente gravados em restaurantes ativos. Arquivos órfãos após remoção física ou sem referência de perfil não são públicos.
- Falhas de imagem exibem a composição de fallback do tema. Erros de leitura não expõem mensagens do banco.

## Metadados

Gerar title e description a partir do perfil e dados Open Graph usando a capa quando existir. Restaurantes não públicos recebem a mesma resposta 404 e não são indexados.

## Fora de escopo

- Feedback Tavvi, avaliações, notas ou comentários.
- Editor, publicação, busca, filtros ou exibição de categorias/pratos/preços.
- Pedido, carrinho, pagamento, chamada de equipe ou qualquer ação contextual de mesa.
- Alterações no onboarding visual, na escolha de identidade, na home institucional, nos fluxos de Admin/Painel ou em subdomínios/domínios personalizados, exceto a reserva de slug necessária para preservar as rotas estáticas.
- Horários, email, telefone comercial Tavvi ou outros dados ausentes do perfil persistido.
- Novas dependências e testes automatizados.

## Critérios de aceite

- Um visitante sem sessão abre `/{slug}` de restaurante ativo, com ou sem cardápio publicado.
- Rascunho, suspenso, registro removido e slug inexistente recebem a mesma experiência 404.
- Slugs reservados não podem ser atribuídos por geração automática nem edição administrativa.
- A página mostra os dados públicos disponíveis e oculta campos ausentes.
- A descrição conserva o limite de 500 caracteres do cadastro, inicia com resumo de até 180 caracteres no limite de palavra e expande/recolhe somente quando necessário; começa alinhada à esquerda sob toda a linha logo/nome.
- A capa móvel respeita a faixa de 160–220px do padrão original, os links de contato usam a ordem original e o logo não ganha borda clara no modo escuro.
- O toggle do perfil percorre sistema/claro/escuro, preserva a escolha no navegador e não modifica o tema global das telas internas.
- `Ctrl+Alt+T` percorre a aparência do perfil, sem disparar o atalho global enquanto a página pública está ativa.
- Os elementos apresentados entram em sequência com movimento reduzido respeitado.
- Os oito temas e cores personalizadas alteram a apresentação sem afetar Admin/Painel e sem perder contraste.
- As imagens são entregues apenas para logo/capa atualmente salvos em perfil ativo, sem aceitar caminhos arbitrários; referências removidas deixam arquivos órfãos sem acesso público.
- A página funciona em larguras móveis e desktop, com teclado, foco visível e movimento reduzido.
