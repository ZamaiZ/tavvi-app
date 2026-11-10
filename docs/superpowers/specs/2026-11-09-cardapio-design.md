# Cardápio — especificação de produto e interface

**Status:** autorizado para implementação inline pelo usuário em 2026-11-09.  
**Escopo:** domínio integrado do cardápio: gestão no Painel, persistência, publicação e apresentação pública.

## Intenção

Transformar a página `/painel/cardapio`, hoje placeholder, no espaço principal para organizar, revisar e publicar o cardápio do restaurante. A experiência deve ser rápida para operações repetidas, previsível em telas pequenas e segura para o conteúdo público. A interface é nova e nativa de `tavvi-app`; o projeto legado serve somente como referência de regras e comportamento.

## Resultados desejados

- Criar e editar categorias e itens individualmente ou em lote.
- Reordenar categorias e itens, pesquisar, filtrar, ocultar, alterar disponibilidade e mover itens entre categorias.
- Oferecer duas formas de gestão em desktop: Índice (lista/grade) e Quadro.
- Manter no mobile uma lista direta, com ações de toque, menus de contexto, disponibilidade e organização de categorias.
- Separar publicação do cardápio do estado operacional do restaurante.
- Exibir somente o conteúdo elegível quando publicado e preservar o perfil público do restaurante quando o cardápio estiver em rascunho.
- Fazer operações críticas no servidor e no banco, com autorização por restaurante, validação e tratamento de falha visível.

## Fora de escopo

- Modos Studio, Planilha, Sequência e Serviço no editor.
- Carrinho, pedido direto, pagamento ou busca/filtros para visitantes.
- Importação/exportação CSV.
- Alterar o formato público escolhido na Identidade (`immersive`, `catalog-list` ou `catalog-grid`). Essa preferência é da experiência do cliente e é distinta do modo de gestão.
- Importar CSS, tokens, componentes ou identidade visual do legado.

## Decisões aprovadas e regras

### Estrutura e visualizações

- Desktop abre em **Índice**, com a navegação de categorias recolhível. O conteúdo começa como lista e oferece alternância para grade. A lista de categorias permanece disponível nos dois formatos.
- Enquanto o Índice estiver ativo em desktop, `Ctrl+I` recolhe/reabre a barra de categorias. O atalho ignora campos de edição e diálogos; a indicação fica junto ao controle do Índice.
- **Quadro** é a segunda visualização de desktop. Cada categoria é uma coluna com itens em cartões e miniatura da primeira mídia disponível.
- No Quadro, arrastar uma coluna muda a ordem das categorias; arrastar um item muda sua posição **dentro da categoria atual**. Para mover um item entre categorias, usar também o seletor de categoria (combobox). Oferecer ação acessível de mover/reordenar sem arraste.
- No mobile, manter a gestão em lista, agrupada por categoria, sem Índice/Quadro. Manter acesso às ações por toque/contexto, seletor para mover categoria e controles de disponibilidade. Reordenação precisa ter alternativa por botões de mover para cima/baixo.
- A preferência de gestão (Índice/Quadro e lista/grade) é local por restaurante; não altera `restaurants.menu_presentation` nem o conteúdo salvo.

### Conteúdo e operações

- Categorias: nome, descrição opcional, visibilidade e posição. Não excluir categoria com itens; o usuário move ou exclui os itens primeiro.
- Itens: categoria, nome, descrição, visibilidade, disponibilidade, preço único ou até 30 variações com disponibilidade própria, destaques livres, atributos estruturados e até seis mídias (fotos ou vídeos curtos, respeitando os limites validados no legado).
- Itens indisponíveis permanecem visíveis, com estado explícito; indisponibilidade não equivale a ocultação.
- Pesquisa cobre nome e descrição do item. Filtros: todos, sem mídia, indisponíveis e ocultos. Resultados vazios devem distinguir busca sem resultado de cardápio ainda vazio.
  - A criação em lote aceita até 50 itens e até 20 categorias novas por envio. O fluxo permite cadastrar categoria, nome, descrição, preço único ou variações com disponibilidade individual, além de mídias; destaques e atributos podem ser ajustados no editor completo depois do lote. Valida as linhas antes de persistir.
- Um rascunho de lote é recuperável depois de recarga no mesmo navegador, vinculado ao restaurante e à versão do schema. Persistir localmente texto e Blobs de mídia em IndexedDB; não usar `localStorage` como fonte do rascunho nem para autorização. Oferecer continuar ou descartar; limpar somente após commit bem-sucedido ou descarte explícito. Falha/limite do IndexedDB não pode apagar o formulário em uso.
- Mídias são enviadas diretamente do navegador ao Supabase Storage por autorização curta; bytes não passam por Server Action. Escrita de metadados e lote deve ser atômica no banco. Uploads parciais devem ser removidos ou permanecer recuperáveis sem aparecer no público.

### Atributos

- Separar **Destaques** (texto livre) de atributos de **Dietas/restrições** e **Alergênicos** (estruturados). Nunca inferir “sem X” pela ausência de um atributo.
- Começar com sugestões de dieta/restrição: vegetariano, vegano, sem glúten, sem lactose e picante. Começar com alergênicos comuns: leite, ovos, trigo/glúten, soja, amendoim, castanhas, peixe, crustáceos e gergelim. Esta lista inicial é uma decisão de implementação e pode ser ampliada.
- Permitir criar atributo personalizado por restaurante e reutilizá-lo em itens futuros. Alergênico selecionado requer qualificador **contém** ou **pode conter**; os demais atributos não usam esse qualificador.

### Publicação e acesso público

- `restaurants.status` continua representando o estado operacional (`draft`, `active`, `suspended`); o cardápio recebe seu estado independente `draft`/`published`.
- Publicar exige ao menos um item efetivamente público. Um item efetivamente público pertence a categoria visível, está visível e tem pelo menos uma mídia confirmada. Itens indisponíveis ainda contam e são exibidos como indisponíveis.
- Enquanto publicado, gravações entram no ar imediatamente. O servidor/banco bloqueia operação que deixe zero itens efetivamente públicos; o usuário precisa despublicar antes de retirar o último.
- A leitura pública verifica também que o restaurante está ativo, o cardápio está publicado e os registros estão visíveis. Rascunhos, categorias ocultas e itens ocultos/não elegíveis nunca são enviados ao visitante.
- Todos os arquivos de mídia associados a um item elegível ficam acessíveis na apresentação pública, em uma faixa horizontal navegável; vídeos não carregam metadados até interação.
- A URL pública continua `/{slug}`. O perfil, contato e identidade atuais permanecem; o bloco “Cardápio em construção” é substituído pela apresentação escolhida na Identidade quando publicado. Despublicar restaura o estado de construção e mantém o perfil acessível.
- A leitura de cardápio público deve ser separada da leitura do perfil e não pode incluir contexto/token de mesa. Mídia pública só é servida quando ainda está associada a conteúdo elegível.

## Direção de experiência visual

- Usar shadcn + Tailwind e tokens existentes; sem CSS de feature para o Painel. Manter a linguagem da tela de Cardápio, shell do Painel, componentes e densidade encontrados neste app.
- Hierarquia por restaurante/status, barra de pesquisa/filtros, alternância Índice/Quadro e ações de criação/publicação. Evitar competir com a navegação global do Painel.
- Usar ícones Lucide já adotados em `react-icons/lu`, rótulos claros e dica contextual quando um ícone sozinho não for suficiente.
- Campos de escolha usam o `Combobox` do design system, nunca `<select>` nativo ou o seletor alternativo. Inputs de texto e descrição recebem ícones coerentes; entrada de preço usa máscara BRL com `R$`, centavos e limite validado.
- Ações destrutivas pedem confirmação. Erros de lote apontam a linha/campo; sucesso e falha são anunciados e preservam o estado editável.
- Skeleton acompanha a forma do modo carregado, com fallback responsivo que não pisca entre desktop e mobile.
- Transições usam `motion/react` no padrão do shell: curtas, sequenciais e discretas. Reservar movimento para troca de conteúdo, entrada/saída e feedback de reorder; respeitar `prefers-reduced-motion`. A 404 é referência de acabamento e ritmo, não de ambientação constante numa tela operacional.
- DnD inclui teclado, alvo/foco visível, anúncios acessíveis e alternativa sem arraste. Mobile não depende de hover nem de DnD.

## Segurança e integridade

- Cada Server Action valida entrada, autentica a sessão Painel e deriva o restaurante ativo do cookie validado no servidor; nunca confia no `restaurant_id` do cliente para autorização.
- RLS e funções/RPCs do Postgres reforçam associação e invariantes. RPCs públicos são estreitos, retornam apenas DTO público e não expõem caminhos ou registros privados sem necessidade.
- Categorias, itens, variações, relações de atributo, mídia e publicação precisam de constraints e operações transacionais onde uma ação alterar mais de uma tabela.
- Atualizações do menu invalidam a leitura pública do cardápio daquele restaurante; não invalidar nem misturar a sessão/estado de mesa.
- `service_role` e credenciais privilegiadas permanecem no servidor. Uploads e leitura de mídia não contornam o escopo do restaurante/menu.

## Referências e limites técnicos

- `__BASE.MD`, seções 5 e 6, para arquitetura, regras do domínio, publicação, mídia, público e desempenho.
- `C:\Users\Eduardo Zamai\Documents\tavvi\apps\web\src\features\workspace\components\menu-workspace.tsx` e `features\menu-editor` do legado, somente para comportamentos e regras.
- `features/panel/workspace/components/panel-app-shell.tsx`, `features/panel/workspace/components/panel-menu-template.tsx`, `features/public-profile` e `components/ui` neste app para os padrões visuais atuais.
- Next.js 16: Server Components mantêm leitura de dados; Server Actions são pontos de entrada não confiáveis e validam autenticação, autorização e payload. A mutação retorna DTO enxuto e invalida a rota/dado afetado.
- Instruções locais proíbem Git, testes, typecheck, build e lint. A entrega será revisada por leitura estática; essa limitação não significa verificação de runtime.

## Questões deixadas ao implementador

- Escolher nomes de tabelas/RPCs e decomposição de arquivos alinhados ao app, preservando as regras acima.
- Preferir a biblioteca DnD já usada no legado se uma dependência compatível puder ser instalada sem introduzir estilos/arquitetura paralelos; caso contrário, implementar com a solução apropriada ao app e registrar o motivo.
- Ajustar o desenho responsivo e comportamento de foco ao que os componentes shadcn/Base UI disponíveis suportam.
