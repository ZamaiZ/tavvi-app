# Busca pública de restaurantes — Plano de implementação

> **Para agentes implementadores:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` e execute as tarefas neste checkout, em sequência. O projeto proíbe testes automatizados e comandos `git`, `typecheck`, `build`, `lint` e `test`; não adicionar nem executar nenhum deles.

**Objetivo:** Permitir que visitantes encontrem restaurantes ativos pela home e abram o perfil público existente, com ou sem cardápio publicado.

**Arquitetura:** Uma RPC `SECURITY DEFINER` consulta apenas campos públicos de restaurantes ativos e retorna páginas de 20 resultados. Um Route Handler valida os parâmetros e a resposta; um Client Component usa a Combobox Base UI existente, aplica debounce e encaminha a seleção à rota `/{slug}`. A página inicial continua Server Component.

**Stack:** Next.js 16.4.2 App Router, React 19.3.1, Supabase JS 2.118.0, PostgreSQL/Supabase, Zod 4.6.7, Tailwind CSS 4, `@base-ui/react` e `react-icons` já instalados.

**Spec:** `docs/superpowers/specs/2026-11-09-public-restaurant-finder-design.md`

## Restrições globais

- Exibir exclusivamente restaurantes existentes com `status = active`; não depender de publicação de cardápio.
- Excluir `admin` e `painel` da listagem, pois a rota pública existente rejeita esses slugs.
- Retornar somente `slug`, `name`, `segment`, `hasLogo` e endereço permitido; não expor caminho de Storage, telefone, descrição, tema ou outros dados.
- Não conceder leitura anônima à tabela `restaurants`, não reutilizar RPC de Admin e não usar service role.
- Pesquisar por nome, segmento e endereço, sem diferenciar caixa ou acentos; limitar consulta a 120 caracteres e prevenir curingas SQL.
- Usar lotes fixos de 20 e ordenar por nome normalizado e slug.
- Debounce de 250 ms; desconsiderar respostas antigas quando a consulta mudar.
- Usar o endpoint `/api/public/restaurants?q=<texto>&page=<n>` e a RPC `public.list_public_restaurants(p_search text, p_page integer)`.
- Renderizar cada resultado apenas com logo/inicial, nome, segmento e endereço; ocultar dados opcionais ausentes.
- Abrir `/{slug}` ao selecionar; manter essa página e seu tratamento atual de restaurantes não ativos.
- Não adicionar dependências nem testes; não executar `git`, `typecheck`, `build`, `lint` ou `test`.

## Foco de revisão manual

- `draft`, `suspended`, registros removidos e slugs reservados não devem aparecer, mesmo com busca vazia — Tarefas 1 e 2.
- Acentos, caixa, espaços e caracteres como `%` e `_` devem continuar sendo texto literal de busca — Tarefa 1.
- Alternar rapidamente entre consultas não deve mostrar nem permitir selecionar resultados obsoletos — Tarefa 3.
- Logo, segmento e endereço opcionais ou inválidos não devem quebrar nem criar linhas vazias — Tarefas 2 e 3.
- Parâmetros inválidos e falhas do Supabase devem resultar em respostas controladas, sem dados técnicos — Tarefa 2.

---

### Tarefa 1: RPC pública paginada e restrita

**Arquivos:**
- Criar: `supabase/migrations/20261109040000_public_restaurant_directory.sql`

**Interface produzida:**
- `public.list_public_restaurants(p_search text default '', p_page integer default 1) returns jsonb`
- A resposta tem `{ "rows": [...], "hasMore": boolean }`; cada linha contém somente `slug`, `name`, `segment`, `hasLogo` e `address`.
- A função valida tamanho e número de página, filtra `status = 'active'`, procura substring em campos normalizados (nome, segmento e endereço), ordena por nome normalizado/slug e retorna até 21 linhas para montar um lote de 20 e `hasMore`.
- `address` contém somente `cep`, `street`, `number`, `complement`, `district`, `city` e `state`; caminhos de marca não saem da função.

- [x] Criar função `STABLE SECURITY DEFINER` com `search_path = ''`, validação independente de `p_search`/`p_page`, filtro `active` e seleção estrita dos campos definidos.
- [x] Normalizar caixa e acentos com `lower`/`translate`; usar `strpos` ou comparação equivalente que não interprete `%` e `_` como curingas.
- [x] Gerar `rows` e `hasMore` a partir de lotes de 20, mantendo ordenação estável entre páginas.
- [x] Revogar execução de `PUBLIC`, `authenticated` e `anon` antes de conceder somente a `anon`; não alterar grants de tabela ou funções existentes.
- [x] Revisar estaticamente SQL, projeção JSON, paginação, grants e ausência de valores privados; não conectar ao Supabase nem aplicar a migration.

### Tarefa 2: DTO, acesso server-only e Route Handler

**Arquivos:**
- Modificar: `features/public-profile/model.ts`
- Criar: `features/public-profile/server/public-restaurant-search.ts`
- Criar: `app/api/public/restaurants/route.ts`

**Interfaces produzidas:**
- `PublicRestaurantSearchResult`: `{ slug: string; name: string; segment: string | null; hasLogo: boolean; address: PublicRestaurantAddress | null }`.
- `PublicRestaurantSearchPage`: `{ rows: PublicRestaurantSearchResult[]; hasMore: boolean }`.
- `searchPublicRestaurants(input: { query: string; page: number }): Promise<PublicRestaurantSearchPage>`.
- `GET /api/public/restaurants?q=<texto>&page=<n>` responde JSON validado; parâmetros inválidos recebem `400`, indisponibilidade recebe `503` genérico e respostas usam `Cache-Control: no-store`.

- [x] Definir schema Zod da resposta pública e parser que valide slugs, nomes, segmento, logo booleana, endereço permitido e `hasMore`.
- [x] Implementar a consulta server-only com `createSupabasePublicClient()` e a RPC da Tarefa 1; registrar somente códigos de erro e retornar falha genérica.
- [x] Implementar Route Handler GET com validação de `q` (até 120 caracteres) e `page` inteiro positivo dentro do limite adotado pela RPC.
- [x] Validar a resposta desconhecida da RPC antes de serializá-la; não incluir chave de serviço, caminho Storage, mensagem do Supabase nem dados extras.
- [x] Revisar manualmente a fronteira server/client, validação dos parâmetros e formatos de erro sem executar comandos proibidos.

### Tarefa 3: Combobox e integração visual na home

**Arquivos:**
- Criar: `features/public-profile/components/restaurant-finder.tsx`
- Modificar: `app/page.tsx`

**Interface produzida:**
- `RestaurantFinder()` é o pequeno Client Component da home; importa `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem` e `ComboboxEmpty` de `components/ui/combobox.tsx`.
- Ao abrir, busca a primeira página com query vazia. A digitação inicia timer de 250 ms, limpa/aborta pedido anterior e carrega a página 1 da nova consulta. `Ver mais restaurantes` busca e acrescenta a próxima página sem misturar consultas diferentes.
- Seleção por clique ou teclado navega com `useRouter().push('/' + slug)` e fecha o popup.

- [x] Construir input de 56 px com label acessível, ícone de busca, texto de apoio “Busque por restaurante, cozinha ou endereço” e controle de limpar quando houver texto.
- [x] Controlar foco/abertura, query, estado de carregamento, resposta atual, paginação, erro e valor selecionado; impedir respostas antigas de substituir o resultado da query atual.
- [x] Construir lista em popover portal limitado à altura disponível, com Skeleton enquanto carrega, mensagem de vazio/sem correspondência, erro com nova tentativa e ação acessível de paginação.
- [x] Renderizar itens com `BrandImage` e rota de mídia existente somente quando `hasLogo`; fallback é inicial do nome. Mostrar nome, segmento opcional e endereço compacto opcional com ícones existentes; não mostrar status ou descrição.
- [x] Aplicar alvo mínimo de toque, foco visível, navegação da Combobox, anúncio acessível do estado e transições curtas que respeitam movimento reduzido e temas claro/escuro.
- [x] Inserir a busca abaixo do texto principal em `app/page.tsx`; ajustar a descrição da home para refletir busca, mantendo logotipo, tema e acesso ao Painel.
- [x] Revisar manualmente a cobertura dos critérios da spec e ler novamente os arquivos finais. Não iniciar servidor nem executar testes ou outros comandos proibidos.

## Decisões de implementação

- A home segue Server Component e somente a busca precisa de estado no cliente, conforme o guia local de Client/Server Components do Next.js 16.
- A consulta dinâmica usa Route Handler GET; os Route Handlers atuais do Next.js não são cacheados por padrão, e o endpoint declara `no-store` também na resposta.
- A lista usa a Combobox Base UI existente para foco, setas, Enter e Escape; o popup usa o portal já fornecido pelo componente e evita o `overflow-hidden` da home.
- O campo `segment` é mostrado com o conteúdo cadastrado; não será renomeado nem normalizado para sugerir categorias de cozinha inexistentes.
- Os arquivos serão editados no checkout atual conforme a instrução de implementação nativa; nenhuma criação de branch/worktree, commit ou comando Git será usada.
