# 404 e acesso público — especificação

## Objetivo

Oferecer uma página 404 única, elegante e acessível para rotas inexistentes e tentativas sem sessão de acessar áreas protegidas, mantendo públicas as rotas de autenticação, criação de conta, convite e perfis de restaurantes ativos.

## Regras de acesso

- Visitantes sem sessão podem acessar login, criação de conta e convite.
- Perfis públicos de restaurante não exigem sessão e só aparecem quando o registro existe e `status = active`.
- Restaurantes em `draft`, `suspended`, removidos fisicamente, slugs inexistentes ou inválidos recebem a mesma resposta 404.
- Para rotas que exigem sessão, a falta de sessão renderiza a mesma interface 404 usada para URLs inexistentes; não redireciona ao login.
- Sessão existente não transforma uma URL inexistente em válida.
- A UI 404 não substitui verificações de autenticação/autorização em consultas, mutations, handlers ou server actions.

## Conteúdo e experiência

- Mensagem genérica em português, sem indicar se a origem foi falta de sessão ou URL inválida.
- Ações para voltar à página pública inicial, entrar como administrador e entrar no painel.
- A página usa o tema claro/escuro Tavvi, com gradiente de marca animado e acabamento visual consistente.
- Animação de entrada escalonada para os dígitos 404, texto e ações; animação decorativa respeita `prefers-reduced-motion`.
- Layout responsivo, contraste adequado, navegação por teclado, foco visível, alvos de toque confortáveis e sem dependência de cor ou movimento para compreender a mensagem.
- O HTML de erro mantém semântica de título principal e links com nomes claros.

## Escopo atual

- Criar uma experiência 404 raiz reaproveitável.
- Padronizar a falta de sessão nas rotas protegidas existentes de admin e painel.
- Preservar login, cadastro, convite e landing pública.
- A rota pública por slug exibe somente o perfil do restaurante ativo, independente da publicação do cardápio.

## Fora de escopo

- Implementar catálogo público, feedback ou operações de mesa nesta entrega.
- Alterar autorização por função/role para usuários autenticados.
- Alterar a renovação de sessão, cookies, rewrites ou redirecionamentos canônicos do `proxy`.
- Adicionar dependências ou testes.
