# Perfil público do restaurante — Plano de implementação

> **Para agentes implementadores:** executar as tarefas em sequência neste checkout. Não adicionar testes nem executar `git`, `typecheck`, `build`, `lint` ou `test`, conforme as instruções do projeto.

**Objetivo:** Exibir `/{slug}` como perfil público de restaurantes ativos, com identidade e contato salvos, mesmo sem cardápio publicado.

**Arquitetura:** Uma rota server-rendered carrega um DTO público mínimo por RPC anônima e deixa a tabela `restaurants` protegida por RLS. Um endpoint interno serve somente as imagens atuais do perfil; tema, tipografia e composição ficam isolados na feature pública.

**Stack:** Next.js 16.4.2 App Router, React 19.3.1, Supabase JS 2.118.0, Postgres/Supabase, Zod 4.6.7, CSS Modules, `next/font` e `react-icons` já instalados.

**Spec:** `docs/superpowers/specs/2026-11-09-public-restaurant-profile-design.md`

## Restrições globais

- Somente registros existentes com `status = active` podem ser exibidos; `draft`, `suspended` e inexistentes recebem a mesma 404. O schema atual não implementa exclusão lógica.
- Feedback Tavvi e conteúdo de cardápio estão fora desta entrega.
- A home `/`, Admin e Painel permanecem intactos.
- `admin` e `painel` ficam reservados; geração automática usa `-restaurante`, edição manual recusa os nomes reservados e registros existentes não são renomeados automaticamente.
- Não conceder `SELECT` anônimo em `restaurants`; não usar service role.
- Storage público só serve caminhos de logo/capa atualmente salvos em perfil ativo; arquivos órfãos não são públicos.
- Reproduzir no perfil a composição de capa/catalog, a ordem dos ícones, o controle de aparência e as linhas de ação do Tavvi original; estilos permanecem isolados na feature pública.
- Manter limite de descrição de 500 caracteres e resumir em até 180 caracteres por palavra no perfil, com expansão acessível.
- Usar toggle de aparência `system → light → dark → system`, `localStorage["tema-cardapio"]` e `data-menu-appearance`, sem controlar o tema global do app.
- No perfil, `Ctrl+Alt+T` percorre o mesmo ciclo e impede que o atalho global do `ThemeProvider` altere apenas `html.dark`.
- Usar animações de entrada CSS curtas e sequenciais para os elementos visíveis, respeitar movimento reduzido e não adicionar dependências.
- Respeitar Next.js 16; a documentação local de segmentos dinâmicos, handlers, metadata, imagens e fontes foi consultada antes da implementação.
- Nenhum teste será adicionado ou executado. Nenhum comando `git`, `typecheck`, `build`, `lint` ou `test` será executado.

## Foco de revisão manual

- Slug desconhecido, inválido, `draft`, `suspended` ou removido sempre termina em 404 — Tarefa 4.
- `admin` e `painel` não podem ser usados como slugs por cadastro ou edição — Tarefa 1.
- Logo/capa só são lidas a partir do registro ativo; caminhos arbitrários e arquivos antigos não são aceitos — Tarefas 1 e 2.
- Campos opcionais ausentes, contato inválido e tema antigo ou malformado não quebram a página — Tarefas 2 e 3.
- Capa/logo ausentes, nenhum link de contato e menu não publicado deixam uma página completa e legível em celular/desktop — Tarefa 4.

## Decisões de revisão

- **Slugs reservados:** a rota dinâmica não pode sobrepor as páginas estáticas `/admin` e `/painel`; nomes gerados ou editados passam a proteger esses caminhos. Nenhum slug já salvo será alterado em lote, evitando quebrar links existentes. O custo é exigir correção manual pelo Admin caso um registro antigo use um desses valores.
- **Policy de marca:** restringir também o acesso anônimo direto ao Storage às referências atuais em registros ativos. A tabela não possui exclusão lógica; remoção física elimina o registro e deixa seus arquivos sem referência pública. A rota interna aplica a mesma regra.

---

### Tarefa 1: Fronteira pública, policy de mídia e slugs reservados

**Arquivos:**
- Criar: `lib/routing/reserved-slugs.ts`
- Modificar: `features/admin/restaurants/schema.ts`
- Criar: `supabase/migrations/20261109030000_public_restaurant_profile.sql`
- Atualizar: `docs/superpowers/specs/2026-11-06-not-found-and-public-access-design.md`

**Interfaces:**
- Produzir `isReservedRestaurantSlug(value: string): boolean` e `RESERVED_RESTAURANT_SLUGS` com `admin` e `painel`.
- `updateRestaurantSlugSchema` recusa valores reservados com mensagem de campo clara; o esquema base permanece compatível com registros existentes.
- A migration cria `public.get_public_restaurant_profile(p_slug text) returns jsonb`, sem dados se slug for inválido, reservado, inexistente ou não ativo.
- A migration substitui `public.platform_restaurant_slug(text)` para anexar `-restaurante` quando o resultado exato for reservado e substitui `public.update_platform_restaurant_slug(uuid,text)` para responder `slug_unavailable` em slug reservado.
- A migration substitui `public.panel_brand_public_active(text)` para permitir somente logo_path/cover_path atualmente referenciados em restaurante ativo existente.

- [x] Adicionar o conjunto de slugs reservados e usá-lo na validação administrativa.
- [x] Criar RPC pública `SECURITY DEFINER`, `STABLE`, com `search_path = ''`, validação do slug e seleção somente dos campos `slug`, `name`, `description`, `segment`, `logo_path`, `cover_path`, `contact` e `theme`.
- [x] Revogar execute de `PUBLIC` e conceder apenas a `anon` e `authenticated`; manter grants da tabela `restaurants` sem leitura anônima.
- [x] Atualizar o helper de Storage para checar status ativo e igualdade do caminho com `logo_path` ou `cover_path` salvo; arquivo sem referência não é público.
- [x] Substituir funções SQL de geração/edição de slug sem alterar registros existentes.
- [x] Revisar manualmente a migration, o retorno da RPC e os grants sem conectar ou alterar o banco remoto; o schema não declara `deleted_at` nem exclusão lógica.

---

### Tarefa 2: Cliente público, DTO e entrega de logo/capa

**Arquivos:**
- Criar: `lib/supabase/public.ts`
- Criar: `features/public-profile/model.ts`
- Criar: `features/public-profile/server/public-profile.ts`
- Criar: `features/public-profile/server/brand-media.ts`

**Interfaces:**
- Produzir `createSupabasePublicClient()` sem cookies de Admin/Painel, com persistência e refresh de sessão desativados.
- Produzir `getPublicRestaurantProfile(slug: unknown): Promise<PublicRestaurantProfile | null>`, usando `React.cache` por requisição e `get_public_restaurant_profile`.
- Produzir `getPublicRestaurantBrandMedia(slug: unknown, slot: unknown): Promise<PublicRestaurantBrandMedia | null>`, onde `slot` aceita somente `logo` ou `cover`; resposta contém bytes e tipo MIME, nunca caminho de Storage.
- O DTO aceita retorno JSON, valida conteúdo com Zod, normaliza contatos incompletos e descarta links com protocolo/host não permitido.

- [x] Criar cliente anônimo a partir da URL e publishable key atuais; configurar `persistSession: false` e `autoRefreshToken: false`.
- [x] Definir esquema e tipo público com fallback seguro para contatos e tema inválidos.
- [x] Carregar o perfil pela RPC e memoizar somente dentro da renderização atual.
- [x] Resolver a imagem pelo perfil atual e pelo slot fixo; fazer download pelo cliente anônimo sujeito à policy Storage.
- [x] Revisar manualmente que nenhum caminho arbitrário ou segredo de serviço chega à resposta.

---

### Tarefa 3: Tokens visuais e fontes por preset

**Arquivos:**
- Criar: `features/public-profile/theme.ts`
- Criar: `features/public-profile/fonts.ts`

**Interfaces:**
- Produzir `resolvePublicTheme(raw: unknown): ResolvedPublicTheme`, com valores de luz e escuro, fontes e raios do preset, cores do perfil e pares foreground/background acessíveis.
- Produzir `PUBLIC_THEME_FONT_VARIABLES` para aplicar as variáveis `next/font` no escopo da página.

- [x] Mapear os oito presets para as duplas display/body da spec e importar fontes com `preload: false`.
- [x] Resolver tema com `safeParse`; dados inválidos usam Grão padrão.
- [x] Preservar base/destaque customizados quando válidos e derivar texto, tinta sobre destaque e tons funcionais com contraste AA.
- [x] Mapear faces claras/escuras e raios do preset sem modificar `app/globals.css`.
- [x] Revisar manualmente os tokens dos oito presets e as regras de contraste para as duas faces por inspeção estática.

---

### Tarefa 4: Página pública responsiva e metadados

**Arquivos:**
- Criar: `app/[slug]/page.tsx`
- Criar: `app/[slug]/media/[slot]/route.ts`
- Criar: `features/public-profile/components/restaurant-public-profile.tsx`
- Criar: `features/public-profile/components/brand-image.tsx`
- Criar: `features/public-profile/components/public-profile-controls.tsx`
- Criar: `features/public-profile/styles/public-profile.module.css`
- Modificar: `app/layout.tsx` para inicializar a preferência de aparência antes da hidratação.

**Interfaces:**
- A página Server Component recebe `params: Promise<{ slug: string }>` e carrega `getPublicRestaurantProfile`.
- `generateMetadata` usa o mesmo carregador e define title, description e Open Graph da capa; slug não público usa metadados genéricos da 404.
- Handler GET de mídia recebe `params: Promise<{ slug: string; slot: string }>` e devolve bytes apenas para slot válido e perfil público.
- A casca do perfil renderiza a capa catalog, logo/segmento/nome em linha, descrição expansível, contatos circulares na ordem original, endereço, avaliação no Google e uma linha estática de cardápio em construção, sem incluir caminhos Storage no DOM.
- `PublicAppearanceToggle` e `Ctrl+Alt+T` percorrem `system`, `light`, `dark`, `system`; ambos persistem `tema-cardapio` e alteram apenas `data-menu-appearance`.

- [x] Criar o handler de mídia com slot fechado, MIME de imagem validado, `nosniff` e cache público curto.
- [x] Criar página dinâmica e chamar `notFound()` para qualquer resultado sem perfil ativo.
- [x] Reorganizar a apresentação para o padrão catalog original, incluindo capa móvel de 160–220px, identidade em linha, ícones circulares, endereço e lista de ações; manter “Cardápio em construção” estático e remover o CTA de feedback.
- [x] Adicionar o resumo de 180 caracteres com limite de palavra, botões acessíveis “Exibir mais”/“Exibir menos” e alinhamento da descrição abaixo de logo/nome.
- [x] Adicionar o toggle de aparência de três estados, persistência original, atalho `Ctrl+Alt+T` com captura antes do listener global e inicialização pré-hidratação sem alterar o `ThemeProvider` do app.
- [x] Ajustar borda e encaixe do logo à base do tema ativo; revisar cores claras/escuras e foco visível.
- [x] Animar em sequência os elementos individuais da apresentação com CSS e `prefers-reduced-motion`, sem bloquear interação.
- [x] Criar metadados dinâmicos com a capa como imagem Open Graph quando disponível.
- [x] Cobrir layout responsivo, os três estados de aparência e fallbacks via regras CSS e revisão estática; a prévia visual em navegador não foi executada.

---

### Tarefa 5: Revisão final de escopo e integração

**Arquivos:**
- Revisar: `app/page.tsx`, `proxy.ts`, `app/admin`, `app/painel`, migration, DAL e feature pública.
- Atualizar: este plano com o estado final das tarefas.

- [x] Confirmar por inspeção que `/` e as rotas existentes de Admin/Painel não foram alteradas e que não há CTA de feedback nem itens/categorias/pratos de cardápio; só aparece o estado estático de construção.
- [x] Confirmar que a rota `/{slug}` permanece pública sem depender de sessão e que os caminhos reservados não podem ser usados em novos slugs.
- [x] Registrar limitações de verificação: nenhum teste, typecheck, build, lint ou comando Git foi executado por instrução do projeto; a implementação visual foi revisada estaticamente, sem prévia visual em navegador. A execução SQL anterior parou na referência inexistente a `deleted_at`; migration e snippet já foram corrigidos, sem reconectar ao banco para determinar se o editor reverteu a transação.
