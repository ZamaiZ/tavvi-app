# 404 e acesso público — especificação

## Objetivo

Oferecer uma página 404 única, elegante e acessível para rotas inexistentes e tentativas sem sessão de acessar áreas protegidas, mantendo públicas as rotas de autenticação, criação de conta, convite e cardápios fora de `DRAFT`.

## Regras de acesso

- Visitantes sem sessão podem acessar login, criação de conta e convite.
- Cardápios públicos não exigem sessão e só podem ser ocultados quando o restaurante estiver em `DRAFT`.
- Para rotas que exigem sessão, a falta de sessão renderiza a mesma interface 404 usada para URLs inexistentes; não redireciona ao login.
- Sessão existente não transforma uma URL inexistente em válida.
- A UI 404 não substitui verificações de autenticação/autorização em consultas, mutations, handlers ou server actions.
- O status `DRAFT` deve resultar em 404 no futuro handler de cardápio público. O status `suspended` não está incluído na exceção definida pelo produto e permanece acessível.

## Conteúdo e experiência

- Mensagem genérica em português, sem indicar se a origem foi falta de sessão ou URL inválida.
- Ações para voltar à página pública inicial, entrar como administrador e entrar no painel.
- A página usa o tema claro/escuro Tavvi, com gradiente de marca animado e acabamento visual consistente.
- Animação de entrada escalonada para os dígitos 404, texto e ações; animação decorativa respeita `prefers-reduced-motion`.
- Layout responsivo, contraste adequado, navegação por teclado, foco visível, alvos de toque confortáveis e sem dependência de cor ou movimento para compreender a mensagem.
- O HTML de erro deve manter semântica de título principal e links com nomes claros.

## Escopo atual

- Criar uma experiência 404 raiz reaproveitável.
- Padronizar a falta de sessão nas rotas protegidas existentes de admin e painel.
- Preservar login, cadastro, convite e landing pública.
- Ainda não há rota dinâmica de cardápio público no App Router. Quando ela for implementada, deve permitir acesso anônimo aos restaurantes fora de `DRAFT`.

## Fora de escopo

- Implementar o cardápio público, que ainda não existe como rota navegável.
- Alterar autorização por função/role para usuários autenticados.
- Alterar a renovação de sessão, cookies, rewrites ou redirecionamentos canônicos do `proxy`.
- Adicionar dependências ou testes.

