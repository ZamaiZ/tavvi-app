# Tavvi — fundo líquido da autenticação

**Status:** superseded by [the static SVG pattern design](2026-10-29-auth-static-pattern-background-design.md)  
**Data:** 2026-10-29  
**Projeto:** tavvi-app  
**Escopo:** fundo animado do shell de autenticação em desktop

## Intenção

Substituir os gradientes independentes atuais por uma composição líquida contínua, elegante e perceptível. A animação deve dar identidade ao acesso sem competir com o formulário, reduzir a sensação de painel vazio e reagir discretamente ao movimento do mouse.

## Direção visual

- Compor um grupo de três lóbulos que se fundem em uma única forma orgânica, concentrada no hero à esquerda.
- Usar sombreamento pseudo-3D e reflexos verde-menta e verde Tavvi; o brilho pode lembrar neon, mas sem contorno forte, flashes ou aparência de jogo.
- Manter o fundo transparente fora da forma. O brilho nasce da própria superfície e cai por distância; não somar vários halos CSS independentes.
- Fazer uma pequena parcela da luz atravessar a divisão do cartão. No início do formulário ela já deve estar reduzida e chegar a quase zero até aproximadamente 70% da largura total do cartão.
- Preservar o contraste do logo e do texto do hero. O formulário permanece acima do canvas, com seus campos, foco e botões sem tintura perceptível.

## Movimento e mouse

- Animar a composição em repouso com uma deriva orgânica lenta e contínua. Usar funções determinísticas de baixa frequência para forma e posição, sem sorteios por frame, quedas por gravidade ou trilhas.
- Receber o ponteiro em todo o cartão. Converter as coordenadas para o espaço local do shader e suavizá-las com amortecimento; o ponteiro exerce uma força pequena sobre a superfície, com deslocamento máximo inicial de 14 px no hero e 4 px no lado distante do formulário.
- Ao sair do cartão, a influência do ponteiro volta ao repouso sem salto. Não atualizar estado React a cada frame.
- Com `prefers-reduced-motion: reduce`, desenhar uma composição estática e não animar em resposta ao mouse.

## Arquitetura

- Renderizar a decoração em um `<canvas>` com WebGL2 e shaders GLSL próprios, sem adicionar Three.js, Verly.js ou outra dependência. O shader soma três campos de metaball e aplica um limiar comum para formar um único contorno, com deformação orgânica de baixa frequência, luz especular contida e halo com queda espacial.
- Manter o renderer e os shaders em um módulo dedicado ao fundo de autenticação. O componente React fornece o canvas, mede a superfície, encaminha eventos de ponteiro sem state por frame e limpa recursos no unmount.
- Usar a mesma camada em login e criação de conta, pois ambos já compartilham `AdminAuthShell`. O escopo continua restrito ao desktop; mobile mantém a composição existente.
- O canvas ocupa somente o cartão de autenticação, fica `aria-hidden` e com `pointer-events: none`. O shell posiciona o canvas acima do fundo base e abaixo do hero e do formulário.
- A cor vem dos tokens semânticos existentes (`--primary`, `--chart-1`, `--chart-2` e `--chart-5`), mapeados respectivamente para `primary`, `highlight`, `glow` e `shadow` no shader. Um probe DOM resolve esses tokens e `--background` para cores de shader quando o tema muda; a luminância do fundo ajusta a intensidade para o efeito continuar visível nos dois temas, sem alterar tokens globais.
- Tornar translúcido o fundo atual do hero, que hoje cobre o brilho. Evitar adicionar uma segunda camada de glow no formulário; a queda por distância e a atenuação horizontal pertencem ao shader.

## Desempenho e compatibilidade

- Criar o contexto WebGL2 somente em desktop (a partir do breakpoint atual de 768 px), sem acessar APIs do navegador durante renderização no servidor.
- Limitar o `devicePixelRatio` usado pelo canvas a 1.25 e reduzir a resolução interna se a superfície exceder 900 px no maior eixo.
- Pausar o `requestAnimationFrame` quando a aba estiver oculta; retomar sem salto temporal. Ao desmontar, cancelar o frame, desconectar observadores e liberar buffers, shaders e contexto.
- Se WebGL2 não estiver disponível, o contexto for perdido ou os shaders falharem, mostrar um único halo estático CSS com a mesma paleta; o login continua utilizável. Se o contexto for perdido após a inicialização, interromper o renderer e revelar o fallback até desmontar o componente.
- Respeitar mudança de tema, redimensionamento, navegação por teclado, leitores de tela, seleção de texto e foco dos campos.

## Critérios de aceite

- Em desktop, os três lóbulos parecem conectados e fluidos, sem aparência de três círculos desfocados separados.
- A forma deriva lentamente sem tremores, mudanças aleatórias bruscas ou trilhas.
- Mover o mouse em qualquer coluna provoca uma deformação pequena e amortecida; no formulário o efeito é fraco, e ao sair retorna sem salto.
- O brilho atravessa levemente a divisão e se apaga gradualmente antes de ocupar a maior parte do formulário.
- Os temas claro e escuro preservam a mesma linguagem visual com intensidades legíveis e sem esconder conteúdo.
- Movimento reduzido apresenta um quadro estático. Mobile mantém a apresentação e não inicializa WebGL.
- Falha de WebGL2 resulta no fallback estático, sem erro visível nem perda do fluxo de autenticação.
- Perda do contexto durante a sessão troca para o fallback estático sem deixar o canvas em estado quebrado.
- Nenhuma lógica de autenticação, texto, ordem de campos ou interação do formulário muda.

## Fora de escopo

- Alterar a cópia, marca, formulário ou fluxo de autenticação.
- Animar a interface mobile.
- Simulação de partículas físicas, gotas com gravidade, cursor que controla a forma diretamente ou efeito sonoro.
- Instalar Three.js, Verly.js, outra biblioteca ou alterar tokens globais.
- Mudar páginas fora do shell compartilhado de autenticação.

## Riscos e mitigação

- **Shader complexo para um detalhe de login:** limitar a cena a três campos 2D e um canvas local; manter o GLSL e o ciclo de vida isolados do shell.
- **Brilho ilegível sobre o formulário:** derivar a luz da forma, limitar a energia na divisão e aplicar atenuação horizontal até o ponto de 70% do cartão.
- **GPU ou contexto indisponível:** fallback CSS estático, sem dependência do renderer para autenticação.
- **Custo de GPU em telas densas:** limitar DPR e resolução, pausar em abas ocultas e não criar contexto em mobile.
- **Tema dessincronizado:** observar a classe de tema no elemento raiz e atualizar uniformes sem reiniciar toda a cena.
