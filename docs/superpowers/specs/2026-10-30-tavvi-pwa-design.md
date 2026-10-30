# Tavvi — PWA instalável

**Estado:** aprovado para implementação pelo usuário; instalação depende dos ícones nos tamanhos finais  
**Data:** 2026-10-30  
**Projeto:** tavvi-app  
**Abrange:** todas as rotas do app em cada origem Tavvi, incluindo página pública, Painel e Admin

## Intenção

Permitir que o Tavvi seja adicionado à tela inicial ou instalado como aplicativo a partir de qualquer superfície do produto. A instalação abre o Tavvi em janela independente, sem transformar o projeto em uma aplicação offline.

## Objetivos

- Declarar uma identidade PWA única por origem, disponível em todas as rotas.
- Abrir no endereço raiz da origem (`/`), deixando os rewrites existentes determinarem a superfície em hosts dedicados.
- Usar a marca existente; não redesenhar nem gerar arte.
- Cobrir Android, iPhone/iPad e desktop pelos mecanismos de instalação que cada navegador oferece.
- Manter a solução pequena, baseada nas convenções instaladas do Next.js 16.4.2.
- Tratar eventual cache de leituras de banco como otimização separada da instalação PWA.

## Escopo técnico

- Criar `app/manifest.ts` com `id`, `name`, `short_name`, descrição, `start_url`, `scope`, `display: standalone`, idioma, cores e declarações de ícones.
- Declarar metadados globais para Apple Web App, ícone Apple e `themeColor`, sem alterar títulos específicos das rotas ou acrescentar um sufixo global aos títulos existentes.
- Sincronizar as tags `meta[name="theme-color"]` em `components/theme-provider.tsx` com `resolvedTheme`: branco (`#FFFFFF`) no claro e carvão (`#0D0C0A`) no escuro, inclusive quando a pessoa escolhe o tema manualmente. Não usar a cor de acento.
- Referenciar estes arquivos exportados a partir da arte existente:
  - `public/pwa/icon-192.png` — 192×192.
  - `public/pwa/icon-512.png` — 512×512.
  - `public/apple-touch-icon.png` — 180×180.
- O usuário fará o redimensionamento/exportação da marca. O arquivo-fonte quadrado existente é `public/brand/tavvi-favicon.png` (1024×1024); não criar nem substituir arte.
- A mesma configuração se aplica a todas as rotas de uma origem. Origens diferentes (por exemplo, raiz e subdomínio Admin) são instaladas separadamente pelo navegador e, por definição, têm dados de instalação separados.
- O `start_url` é `/`. O host Admin já reescreve essa raiz para `/admin`; em `painel.localhost`, a raiz será servida pela página pública existente, porque a rota `/painel` ainda não existe. Os caminhos não raiz de Painel continuam com os rewrites atuais.

## Instalação por plataforma

- Chromium no Android e desktop: instalação pelo menu ou controle de instalação do navegador quando disponível.
- Safari no iPhone/iPad: Compartilhar → Adicionar à Tela de Início. O ícone Apple dedicado fornece o ícone do atalho.
- Safari no macOS e outros navegadores: usar a opção de instalação/atalho que o navegador disponibilizar.
- Não criar um botão próprio de instalação nesta etapa. Isso evita adicionar estado de prompt e tratamento especial por plataforma sem requisito explícito.
- Produção precisa ser servida por HTTPS; localhost permanece adequado para desenvolvimento.

## Fora de escopo

- Web Push, permissões de notificação, VAPID, inscrição ou backend de push.
- Service worker, Workbox, cache offline, sincronização em segundo plano ou interceptação de requests.
- Página offline, splash screens iOS, precache de assets ou dados.
- Botão próprio para instalar dentro da interface.
- Cache persistente de dados Supabase ou alterações em regras de cache do banco.
- Redesenho, geração ou redimensionamento de ícones pelo agente.
- Testes automatizados ou comandos proibidos pelo `AGENTS.md`.

## Cache de dados

Não confundir instalação PWA com cache de respostas do banco. O service worker não será criado e não haverá cache de respostas autenticadas. O app atual usa Supabase no servidor e chama `revalidatePath()` depois de mutations; sua listagem principal é lida uma vez por renderização. Adicionar `React.cache()` somente a uma função que seja chamada mais de uma vez na mesma renderização seria seguro para deduplicação, mas hoje não reduz consultas entre carregamentos. A referência Tavvi também usa `React.cache()` como memoização de renderização, não como cache persistente entre visitas.

## Comportamento e limites

- O manifesto fica global, então a opção de instalação está disponível nas rotas públicas e privadas.
- `start_url` e `scope` globais são `/`. Em host Admin, o rewrite existente abre Admin; na raiz da origem principal ou de `painel.localhost`, a página pública existente abre. Um futuro início do Painel em sua própria raiz depende de implementar `app/painel/page.tsx`.
- O layout não usa `viewportFit: cover`; a instalação não exige expansão até as bordas e o app não tem tratamento global de safe areas.
- A barra do navegador/status recebe `#FFFFFF` em tema claro e `#0D0C0A` em tema escuro, seguindo o tema ativo do app e sem usar o verde de acento.
- A instalação não implica suporte offline; sem rede, telas que dependem do servidor não carregam.
- Navegadores variam na forma de expor a instalação; no iPhone o fluxo é manual pelo menu de compartilhamento.
- Os arquivos 192×192, 512×512 e 180×180 precisam estar presentes antes de considerar a entrega de ícones concluída. Até lá, o manifesto já pode ser escrito, mas a instalação/iconografia não deve ser declarada validada.

## Critérios de aceite

- `app/manifest.ts` declara uma única identidade Tavvi por origem, `start_url: /`, `scope: /` e `display: standalone`.
- O Next associa o manifesto a todas as rotas; nenhum grupo de rota fica fora do escopo por engano.
- Metadados globais incluem `appleWebApp`, Apple Touch Icon e cor de tema sem apagar metadata específica das páginas.
- A cor de tema acompanha a escolha efetiva claro/escuro do Tavvi e não usa a cor de acento.
- `painel.localhost/` não reescreve para a rota Painel inexistente; as rotas Painel abaixo da raiz mantêm seus rewrites existentes.
- O manifesto referencia os arquivos 192×192 e 512×512 com MIME e tamanhos correspondentes; o layout declara o Apple Touch Icon 180×180.
- Não existe registro de service worker, rota de push, página offline ou cache de requests.
- O escopo da mudança não inclui adicionar cache persistente a leituras Supabase.
- Revisão final será estática; nenhuma suite ou comando proibido será executado.
