# 404 e acesso público — plano de implementação

> **Execução:** nativa nesta sessão, conforme solicitado. Sem testes, typecheck, build, lint ou comandos de Git, conforme as instruções do projeto.

**Objetivo:** Unificar visualmente a 404 para rotas inexistentes e acesso sem sessão a páginas protegidas, preservando rotas públicas.

**Arquitetura:** Um componente compartilhado de apresentação será renderizado por `app/not-found.tsx`; animação e gradientes ficam em CSS Module para manter a página como Server Component. Uma função server-only central verificará claims Supabase nas páginas protegidas e invocará `notFound()` quando não houver identidade autenticada.

**Stack:** Next.js 16.4.2 App Router, React 19, TypeScript, CSS Modules, Supabase SSR já instalado.

**Spec:** [2026-11-06-not-found-and-public-access-design.md](../specs/2026-11-06-not-found-and-public-access-design.md)

## Restrições globais

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não adicionar testes nem dependências.
- Rotas públicas: login, criar conta, convite e cardápio público fora de `DRAFT`.
- Rotas protegidas sem sessão e rotas inexistentes compartilham a mesma mensagem e aparência 404.
- Não usar o `proxy` como única barreira de autorização.

## Foco da revisão

- Página de cardápio público ausente no código atual: não criar uma rota nova neste escopo; registrar o contrato de acesso `DRAFT` na spec.
- Host admin/painel: o CTA de início não pode apontar de volta à área privada no mesmo subdomínio.
- Erro do Supabase: ausência de claims gera 404; falhas operacionais inesperadas devem continuar visíveis como erro de servidor.
- Movimento reduzido: desabilitar animações sem ocultar conteúdo ou atrasar ações.
- Ações de servidor: guards de página não substituem autenticação e autorização nas mutations existentes.

---

### Tarefa 1: Guard de sessão server-side

**Arquivos:**
- Criar `lib/supabase/require-authenticated-surface.ts`.
- Modificar `app/admin/page.tsx`, `app/admin/restaurantes/page.tsx`, `app/painel/page.tsx`, `app/painel/restaurantes/page.tsx`, `app/painel/cardapio/page.tsx`, `app/painel/suspenso/page.tsx` e `app/painel/(onboarding)/layout.tsx`.

**Interface:**
- Produzir `requireAuthenticatedSurface(surface: AuthSurface): Promise<void>`.
- Usar `createSupabaseServerClient(surface)` e `auth.getClaims()`; invocar `notFound()` se houver erro de autenticação ou ausência de `claims.sub`.
- Falhas de infraestrutura não capturadas devem propagar como erro de servidor.

- [x] Adicionar o guard às rotas protegidas: admin `/` e `/restaurantes`; painel `/`, `/restaurantes`, `/cardapio`, `/suspenso` e onboarding.
- [x] Manter `/entrar`, `/criar-conta` e `/convite` fora do guard.
- [x] Remover redirecionamentos de página que mandam visitantes sem sessão ao login; manter redirecionamentos de fluxo autenticado e verificações de autorização existentes.

### Tarefa 2: Página 404 compartilhada e animada

**Arquivos:**
- Criar `app/not-found.tsx`.
- Criar `components/not-found/not-found-experience.tsx` e `components/not-found/not-found-experience.module.css`.
- Criar `lib/routing/not-found-links.ts` para construir corretamente os destinos públicos nas rotas por subdomínio.
- Reutilizar wordmarks e tokens já existentes.

- [x] Implementar mensagem genérica e três destinos: raiz pública, login de administrador e login do painel; resolver caminhos por host.
- [x] Para acessos por subdomínio admin/painel, fazer o destino raiz apontar ao domínio público correspondente e os acessos alternativos ao subdomínio correto.
- [x] Implementar sequência de entrada para 404, texto e ações, fundo gradiente animado sutil e estados hover/focus/active.
- [x] Desativar movimento quando `prefers-reduced-motion: reduce` estiver ativo; manter conteúdo legível sem animação nem atraso.
- [x] Garantir layout mobile-first, sem rolagem horizontal intencional, semântica de landmarks/título, foco visível e alvos de ação adequados.

### Tarefa 3: Revisão estática da política

- [x] Ler os arquivos alterados e confirmar manualmente que nenhuma rota pública recebeu guard.
- [x] Confirmar que admin/painel sem claims invocam `notFound()` antes de carregar conteúdo protegido.
- [x] Confirmar que o `proxy` segue apenas renovando sessão e roteando hosts, e que a UI 404 única serve aos dois casos.
- [x] Não executar comandos de verificação proibidos nem testes.

