# Identificadores — tabela e interações

**Status:** aprovado pelo usuário em 2026-11-13.  
**Escopo:** atualização da apresentação e dos controles da página de identificadores; sem mudanças no domínio ou no fluxo NFC.

## Intenção

Deixar a gestão de mesas mais clara e consistente com shadcn/ui: uma tabela semântica no desktop, ativação por `Switch`, filtros em componentes shadcn e ações secundárias em um menu de clique esquerdo. Clicar na linha abre os detalhes sem depender de um botão visível de abertura.

## Estado atual

- A rota já carrega dados no Server Component e entrega uma workspace cliente com busca, filtros, ações de servidor e diálogos existentes.
- A tabela desktop é uma grade de `div`s com papéis ARIA; filtros são botões próprios; ativação usa botões com ícones.
- O mobile usa cartões e ações com componentes shadcn. O fluxo de detalhes também contém cópia do link, edição e registro/recuperação NFC.
- `@tanstack/react-table` v9 e os componentes shadcn `Table`, `Switch`, `Tabs` e `DropdownMenu` já estão disponíveis.

## Abordagens

1. **Data Table shadcn com TanStack v9 — recomendada.** Renderiza colunas declarativas com os componentes semânticos `Table`, habilita ordenação pela mesa e mantém os filtros existentes. Usa menos controles próprios e segue a versão já instalada.
2. **`Table` shadcn sem TanStack.** Também corrige a semântica, mas não entrega o padrão de Data Table solicitado nem facilita a ordenação pelas colunas.
3. **ContextMenu real na linha.** O componente local abre por clique direito ou toque longo. Não atende ao clique esquerdo pedido e conflita com a abertura dos detalhes quando a própria linha é o alvo.

**Escolha proposta:** abordagem 1. Para ações secundárias, usar `DropdownMenu` acionado por um botão de reticências com clique esquerdo. O termo “ContextMenu” fica como intenção de menu contextual; o componente apropriado para o acionamento escolhido é o `DropdownMenu`.

## Como ficará

- Desktop: tabela com colunas Mesa, Estado NFC, Disponibilidade e Ações. A coluna Mesa permite ordenar; a ordem inicial continua crescente.
- Um clique em área livre da linha abre o diálogo de detalhes. O nome da mesa na primeira célula mantém um foco visível e ativa os detalhes por Enter/Espaço. O `Switch` e o menu não propagam seus eventos para a linha.
- `Switch` controla ativar/desativar e preserva estado ocupado, mensagem de erro e refresh atuais. Filtros passam para `Tabs`/`TabsList`/`TabsTrigger`; busca continua em `Input`.
- O menu de reticências contém ações secundárias — copiar link e editar mesa. A alternância fica visível no `Switch`; detalhes abrem pela linha.
- Mobile: manter o layout de cartões e os alvos de toque atuais, sem redesenho. Preservar as ações do cartão.
- Ajustar o skeleton desktop para representar a nova tabela e remover a antiga coluna/botão de abrir detalhes. Não alterar diálogos, servidor, NFC, navegação ou esquema do banco.
- Usar tokens existentes, estados de foco/hover claros e as animações atuais com suporte a movimento reduzido.

## Limites e critérios

- Busca, quatro filtros e contagens continuam com os mesmos resultados.
- Clique em qualquer área livre da linha abre os detalhes; clique no `Switch` apenas altera a disponibilidade; reticências abrem o menu.
- O diálogo continua sendo a entrada para ações de NFC e mantém os fluxos de edição/cópia disponíveis.
- Nenhuma exclusão, seleção em massa, nova regra de negócio ou ação NFC será adicionada.
- Não executar Git, testes, build, lint ou typecheck; a validação final será por inspeção estática conforme as instruções do projeto.

## Restrições técnicas

A rota Next.js permanece um Server Component para leitura dos dados; a interação continua em componentes com `"use client"`, conforme a documentação local do Next 16. A Data Table seguirá a API v9 já instalada. Toda alteração de interface permanece nas peças da feature `features/panel/identifiers`.
