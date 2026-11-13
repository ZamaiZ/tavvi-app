# Identificadores Data Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atualizar a lista de identificadores para uma Data Table shadcn no desktop, com abertura de detalhes pela linha, `Switch` e menu de ações por clique esquerdo.

**Architecture:** A rota continua lendo dados no Server Component. A workspace cliente mantém busca, filtros, mutações e diálogos; um componente Data Table dedicado renderiza as linhas com TanStack Table v9 e os componentes semânticos do shadcn. Os cartões mobile mantêm o layout e controles visíveis atuais, com menu de contexto por toque longo.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, shadcn/ui Base UI, `@tanstack/react-table` 9.3.1, Tailwind CSS, `motion/react`.

**Spec:** `docs/superpowers/specs/2026-11-13-identificadores-data-table-design.md`

## Global Constraints

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não alterar domínio, Server Actions, NFC, navegação, esquema do banco ou diálogos de detalhes/edição.
- Manter busca, filtros e contagens atuais.
- Manter o layout e as ações visíveis dos cartões mobile; adicionar `ContextMenu` por toque longo com as mesmas ações de copiar link e editar da tabela.
- Usar `DropdownMenu` com botão de reticências para abertura por clique esquerdo; a linha abre detalhes.
- Preservar suporte a movimento reduzido e usar tokens visuais já existentes.
- Ler documentação local do Next.js 16 antes de alterar código Next.js; já revisada para Server/Client Components e `use client`.

## Review Focus

- Nome da mesa focado: Enter/Espaço abre detalhes com foco visível, sem transformar a linha semântica ou seus controles internos em um botão aninhado (Task 1, Step 3).
- `Switch` com mouse/teclado: alterna o estado uma vez e não abre detalhes (Task 1, Step 3).
- Reticências e itens do menu: clique esquerdo abre ações; editar/copiar não abrem o diálogo de detalhes por propagação acidental (Task 1, Step 3; Task 2, Step 2).
- Cartão mobile: toque normal mantém detalhes e ativação; toque longo abre copiar link e editar sem alterar o layout visível (Task 1, Step 4).
- Filtros e busca combinados: contagens e lista mantêm os mesmos dados filtrados (Task 2, Step 1).
- Estados vazio, carregando e mobile: o skeleton acompanha a tabela desktop sem alterar a apresentação dos cartões mobile (Task 2, Steps 1 e 3).

---

### Task 1: Componentes da tabela e status NFC

**Files:**

- Create: `features/panel/identifiers/components/identifier-nfc-status.tsx`
- Create: `features/panel/identifiers/components/identifiers-data-table.tsx`
- Modify: `features/panel/identifiers/components/identifier-list-item.tsx`

**Interfaces:**

- `IdentifierNfcStatus({ identifier }: { identifier: IdentifierDTO })` compartilha os badges NFC sem alterar os rótulos atuais.
- `IdentifiersDataTableProps = { rows: IdentifierDTO[]; busyIdentifierId: string | null; copiedIdentifierId: string | null; onOpen: (identifier: IdentifierDTO) => void; onToggleActive: (identifier: IdentifierDTO) => void; onEdit: (identifier: IdentifierDTO) => void; onCopyLink: (identifier: IdentifierDTO) => Promise<void> }`.
- `IdentifiersDataTable({ rows, busyIdentifierId, copiedIdentifierId, onOpen, onToggleActive, onEdit, onCopyLink }: IdentifiersDataTableProps)` recebe as linhas filtradas e callbacks existentes da workspace.

- [x] **Step 1: Criar o badge NFC compartilhado** em `identifier-nfc-status.tsx`, preservando cores, ícones e rótulos atuais para `protected`, `uncertain` e `pending`.
- [x] **Step 2: Criar `IdentifiersDataTable`** com configuração estável `tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns: { basic: sortFn_basic } })`, `createColumnHelper` e `useTable` da v9. Renderizar `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead` e `TableCell` do shadcn. Declarar as colunas Mesa, Estado NFC, Disponibilidade e Ações; manter definições de coluna estáveis e a ordem inicial recebida da página.
- [x] **Step 3: Implementar interações nas linhas**: clique em área livre abre detalhes; o nome da mesa é um botão textual sem estilo de botão visível e fornece ativação nativa por Enter/Espaço; o `Switch` chama `onToggleActive`; o `DropdownMenu` abre pelo botão de reticências e contém “Copiar link” e “Editar mesa”. Dar rótulos acessíveis aos controles e impedir que suas interações abram os detalhes.
- [x] **Step 4: Simplificar `IdentifierListItem` para os cartões mobile** e usar o novo badge NFC compartilhado. Preservar layout e controles visíveis; adicionar `ContextMenu` por toque longo com copiar link e editar.
- [x] **Step 5: Fazer inspeção estática do componente** conferindo a API v9 instalada, semântica de tabela, sorting, propagação de eventos, nomes acessíveis e foco de teclado.

### Task 2: Integrar tabela, filtros e skeleton

**Files:**

- Modify: `features/panel/identifiers/components/identifiers-workspace.tsx`
- Modify: `features/panel/identifiers/components/identifiers-workspace-skeleton.tsx`

**Interfaces:**

- A workspace mantém `filteredIdentifiers`, os quatro filtros e as Server Actions existentes.
- O callback de cópia atualiza `copiedIdentifierId` por 1,8s e apresenta erro recuperável no estado de mensagem existente.
- `IdentifiersDataTable` recebe `filteredIdentifiers`, o identificador ocupado/copied e callbacks para detalhes, ativação, edição e cópia.

- [x] **Step 1: Trocar filtros próprios por `Tabs`, `TabsList` e `TabsTrigger`** controlados por `filter`; manter busca, rótulos, contagens, filtros e estado vazio.
- [x] **Step 2: Substituir a grade desktop por `IdentifiersDataTable`**; conectar detalhes, ativação, edição direta pelo menu e cópia do link. Manter a lista de cartões e o comportamento mobile existentes.
- [x] **Step 3: Atualizar o skeleton desktop** para refletir a estrutura das quatro colunas e os controles `Switch`/reticências; manter o skeleton mobile atual.
- [x] **Step 4: Fazer revisão estática dos fluxos**: combinar busca/filtro, abrir detalhes pela linha, alternar disponibilidade, copiar link, editar pelo menu, mensagens de erro e estado vazio. Não executar comandos proibidos.

## Revisão final estática

- Reler cada arquivo alterado e confirmar que não houve mudança em ações de servidor, detalhes, editor ou NFC.
- Confirmar que o layout mobile segue igual e que apenas interações desktop previstas foram substituídas.
- Confirmar que nenhuma dependência foi instalada e nenhum comando proibido foi executado.
