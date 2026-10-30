# Tavvi — página informativa da raiz

**Estado:** implementado em tavvi-app; revisão visual local desktop feita  
**Data:** 2026-10-29  
**Projeto:** tavvi-app  
**Abrange:** a rota pública `/` em desenvolvimento local e nos domínios públicos online

## Intenção

Substituir a tela provisória do starter por uma página inicial curta que informe como acessar o cardápio Tavvi. A página deve parecer parte do app atual: simples, clara e tecnológica, usando o verde já definido pelo tema shadcn.

## Objetivos

- Mostrar a mesma página em `localhost:3000/` e na raiz pública dos deploys online, sem variar o conteúdo por `VERCEL_ENV`.
- Informar que o cardápio pode ser aberto por QR Code ou NFC, sem instalar aplicativo.
- Usar um fundo com gradiente verde sutil, animado lentamente e compatível com os temas claro e escuro existentes.
- Manter a composição responsiva, acessível e deliberadamente pequena.
- Preservar o fluxo e as rotas protegidas de Admin.

## Conteúdo fixo

- Identificação visual: wordmark Tavvi na variante adequada ao tema, seguido do texto `CARDÁPIO DIGITAL`.
- Título principal: `O cardápio está na mesa`.
- Texto de apoio: `Acesse pelo QR Code ou NFC do restaurante, sem instalar nada.`

O conteúdo será apresentado em português brasileiro. Não haverá links, botões, formulários, navegação ou chamadas para ação.

## Identidade visual e interação

- Usar a fonte Outfit já carregada pelo layout atual.
- Usar `public/brand/tavvi-wordmark-light.png` no tema claro e `public/brand/tavvi-wordmark-dark.png` no tema escuro. As duas imagens têm dimensões intrínsecas de 420×152 px e devem aparecer como um wordmark pequeno junto de `CARDÁPIO DIGITAL`.
- Usar `--background` e `--foreground` para a superfície e o texto.
- Manter o rótulo e o texto de apoio em `--foreground` para preservar contraste sobre o gradiente animado.
- Usar exclusivamente a variável semântica verde `--primary` já existente para o gradiente. Não introduzir dourado, imagens da marca dourada, novas cores fixas ou mudanças na paleta global.
- Manter o gradiente decorativo em baixa intensidade, atrás do conteúdo, com deriva CSS lenta de aproximadamente 36 segundos. O movimento será pequeno, sem JavaScript, interação com ponteiro ou dependência nova.
- Usar os valores existentes dos temas claro e escuro, aplicados pelo `ThemeProvider`; não adicionar controle visual de tema.
- Com `prefers-reduced-motion: reduce`, deixar o gradiente estático.
- Marcar a camada decorativa como não informativa, sem interceptar ponteiro, foco ou seleção de texto.
- Centralizar o bloco em uma coluna de largura limitada, com espaço generoso e sem cartões, bordas, ilustrações ou seções adicionais.

## Rotas e comportamento

- A rota pública `/` mostra o informativo em desenvolvimento local, Preview e produção, sem redirecionar por ambiente.
- Remover o redirecionamento condicional atual de Preview.
- Esta decisão substitui o redirecionamento temporário da raiz Preview para `/admin` registrado na spec de autenticação Admin; o acesso Admin continua pelas rotas e hosts existentes.
- Como a página não depende de dados da requisição, remover `force-dynamic` depois de conferir a documentação local da versão instalada do Next.js.
- Não alterar `proxy.ts`, o rewrite de `admin.localhost`, `/admin`, `/admin/entrar` nem a autenticação. A raiz de um host Admin continua sendo controlada pelo roteamento existente.
- Definir metadados da página com título `Tavvi — Cardápio digital` e uma descrição curta sobre QR Code e NFC.

## Critérios de aceite

- `/` renderiza o mesmo conteúdo em localhost e nos ambientes públicos online.
- Não há elemento de link, botão ou controle interativo na página.
- O texto visível corresponde ao conteúdo fixado nesta spec.
- O gradiente usa `--primary`; nenhum tom dourado é adicionado à página ou ao tema global.
- Tema claro e escuro mantêm texto legível e deixam o gradiente perceptível, porém discreto.
- O rótulo e o texto de apoio mantêm contraste mínimo de 4.5:1 sobre a superfície com o gradiente.
- O tema claro mostra somente o wordmark `on-light`; o tema escuro mostra somente `on-dark`; a marca permanece acessível como `Tavvi` para leitor de tela.
- Movimento reduzido elimina a deriva sem ocultar o gradiente estático.
- Em telas estreitas, o conteúdo permanece centralizado, legível e sem rolagem horizontal.
- Rotas e comportamentos Admin permanecem sem mudanças.

## Fora de escopo

- Links ou acesso ao painel a partir da página inicial.
- Site de marketing, lista de recursos, navegação global, formulário, login ou interação adicional.
- Alterar os tokens `--primary`, `--accent` ou qualquer cor global.
- Alterar a experiência de autenticação, o proxy, a área Admin ou o tema global.
- Adicionar outras imagens além das duas variantes wordmark já existentes, ícones, fontes, bibliotecas ou dependências.
- Criar ou executar testes automatizados; as instruções do repositório proíbem esses comandos.

## Riscos e mitigação

- **O verde competir com o texto:** manter baixa opacidade e o efeito atrás do conteúdo.
- **A diferença entre temas reduzir a leitura do gradiente:** consumir `--primary` e `--background` existentes em vez de cores fixas.
- **A raiz Preview continuar entrando em Admin:** remover a condição de ambiente da página pública, sem alterar os rewrites do host Admin.
- **Movimento distrair ou prejudicar sensibilidade a movimento:** limitar a deriva e respeitar `prefers-reduced-motion`.
