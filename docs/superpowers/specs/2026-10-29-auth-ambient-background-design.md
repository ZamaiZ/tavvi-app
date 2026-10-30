# Superseded: Tavvi — fundo fluido da autenticação

> This CSS-gradient proposal was superseded after visual review. The later liquid direction is also superseded; the current design is [the static SVG pattern spec](2026-10-29-auth-static-pattern-background-design.md).

**Estado:** rascunho para revisão; não implementado  
**Data:** 2026-10-29  
**Projeto:** tavvi-app  
**Abrange:** fundo animado das telas de autenticação no desktop

## Intenção

Trocar o padrão atual de pontos e anéis por uma atmosfera de gradientes orgânicos que lembre gel translúcido. O movimento deve dar personalidade premium ao acesso sem competir com a marca, os campos ou a ação de entrar.

## Decisões de design

- Concentrar três formas orgânicas de tamanhos diferentes no hero à esquerda.
- Usar gradientes verdes translúcidos da paleta existente, com bordas difusas e um brilho próximo de neon, mas contido.
- Animar cada forma em ciclos lentos, longos e desencontrados, combinando deslocamento, escala e mudança suave da forma. Usar durações iniciais distintas (24 s, 31 s e 39 s) para que a composição pareça irregular sem escolher posições aleatórias durante a renderização.
- Fazer o ponteiro reagir em toda a superfície do cartão, inclusive sobre o formulário. As bolhas acompanham com atraso elástico e poucos pixels de deslocamento; a resposta fica mais fraca no lado do formulário. Ao sair do cartão, a composição retorna suavemente ao repouso.
- Deixar uma pequena parcela do halo alcançar o formulário. Cada gradiente perde intensidade à medida que se afasta do centro, e uma máscara horizontal reduz o brilho através da divisão entre as colunas até fazê-lo desaparecer mais adiante no formulário.
- Usar como ponto de partida um deslocamento máximo de 12–18 px sobre o hero e 3–6 px sobre o formulário. A máscara começa a cair perto da divisão, deixa cerca de 20% de intensidade na região da divisão e chega a zero antes de ocupar a maior parte do formulário; esses valores podem ser refinados na revisão visual.
- Usar as variáveis semânticas de cor da aplicação (`--primary` e `--chart-*`) para adaptar matiz e contraste aos temas claro e escuro.
- Manter o blur fixo, aproximadamente entre 36 e 56 px, e ajustar a opacidade por tema: começar em 8–14% no claro e 14–22% no escuro, refinando a intensidade na revisão visual.
- Com `prefers-reduced-motion: reduce`, manter somente uma composição estática, sem deriva nem resposta ao ponteiro.

## Composição e organização

Criar `AuthAmbientSurface`, um componente cliente que substitui o `div` externo da grade atual do shell. Ele recebe `children` e `className`, mede a superfície de autenticação, atualiza Motion Values de ponteiro e renderiza a decoração atrás do conteúdo. O hero e o formulário permanecem filhos diretos da grade; não adicionar outra moldura ou uma grade aninhada.

Manter a lógica de interação em `auth-ambient-surface.tsx` e os gradientes, formas, ciclos de deriva, máscara e regras de tema em `auth-ambient-surface.module.css`. O shell configura o posicionamento e a ordem de camadas; não calcula animação. O fundo do hero fica levemente translúcido nos dois temas para revelar a animação sem sacrificar a legibilidade; remover o seletor `.auth-ambient` e sua animação global de `app/globals.css`.

O componente compartilhado do shell é usado tanto por login quanto por criação de conta. **Suposição a confirmar na revisão:** aplicar a mesma experiência às duas telas no desktop para manter o fluxo consistente. Se o efeito for exclusivo do login, a integração deve receber um sinalizador opt-in no shell. A estrutura e o fundo mobile permanecem como estão.

## Requisitos de interação e acessibilidade

- A camada decorativa tem `aria-hidden="true"` e `pointer-events: none`; os eventos de ponteiro são escutados na superfície que contém o conteúdo.
- O movimento usa `transform` com spring amortecido, sem guardar posição do ponteiro em estado React nem renderizar novamente por movimento.
- Limitar a decoração a três elementos, mantendo blur estático e animando sobretudo transformações. Não usar canvas, WebGL, shader, simulação física ou dependência nova.
- Manter o painel do hero levemente translúcido nos dois temas, com texto acima da camada de luz, para que a textura apareça sem reduzir legibilidade.
- Respeitar o tema e manter contraste suficiente para texto, foco, campos e botões.
- O efeito não altera comportamento de autenticação, textos, ordem dos campos ou navegação.

## Critérios de aceite

- No desktop, três gradientes verdes orgânicos derivam em ritmos diferentes e não piscam nem se movem de forma abrupta.
- O ponteiro afeta a composição em qualquer ponto do cartão; a reação é menor na área do formulário e retorna suavemente ao sair.
- O halo pode ser percebido perto da divisão e no começo do formulário, mas fica progressivamente mais fraco e não prejudica leitura ou foco.
- Tema claro e escuro têm o mesmo caráter visual, com intensidades apropriadas ao fundo de cada tema.
- Movimento reduzido deixa o visual estático.
- Em larguras mobile, o layout e a apresentação existentes permanecem intactos.
- A criação de conta desktop recebe o mesmo fundo por compartilhar o shell.

## Fora de escopo

- Simular um fluido real ou deformação física.
- Levar o movimento animado para mobile ou para páginas fora do shell de autenticação.
- Mudar a paleta global, a cópia, o formulário ou o fluxo de autenticação.
- Adicionar bibliotecas ou alterar componentes compartilhados de UI.

## Riscos e mitigação

- **Visual lúdico demais:** manter três formas, baixa opacidade, blur amplo e sem contornos neon fortes.
- **Distração no formulário:** concentrar as formas no hero, reduzir a resposta do ponteiro no lado direito e usar queda radial mais máscara horizontal.
- **Custo de composição:** não animar blur nem filtros caros; limitar a superfície ao cartão de autenticação e preservar uma versão estática para movimento reduzido.
