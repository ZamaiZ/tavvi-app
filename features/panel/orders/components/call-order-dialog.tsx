"use client"

import { useState } from "react"
import { MotionConfig } from "motion/react"
import { LuCheck, LuLoaderCircle } from "react-icons/lu"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { PanelServiceCallDTO } from "@/features/panel/calls/model"
import { resolveServiceCallAction } from "@/features/panel/calls/actions"
import type { PanelMenuDTO } from "@/features/panel/menu/model"
import { formatMenuPriceCents } from "@/features/panel/menu/lib/currency"
import { recordPanelOrderAction } from "@/features/panel/orders/actions"
import { OrderEntrySheet } from "@/features/panel/orders/components/order-entry-sheet"
import type { OrderItemInput, RecordPanelOrderResult } from "@/features/panel/orders/model"

function callFailureMessage(code: string) {
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente para registrar o pedido."
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize a página para continuar."
  if (code === "forbidden") return "Sua conta não tem acesso a este restaurante."
  if (code === "not_assignee") return "Somente a pessoa que assumiu este chamado pode registrar o pedido."
  if (code === "call_not_found" || code === "call_conflict") return "Este chamado mudou de estado. Atualize a fila antes de continuar."
  if (code === "item_not_available" || code === "variant_not_available") return "Um item ou uma variação ficou indisponível. Revise o pedido e tente novamente."
  if (code === "variant_required") return "Escolha uma variação para cada item que exige essa seleção."
  if (code === "request_conflict") return "Este envio já foi associado a outro pedido. Reabra o chamado para continuar."
  return "Não foi possível registrar o pedido. Confira a conexão e tente novamente."
}

function dateLabel(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export function CallOrderDialog({
  open,
  call,
  restaurantId,
  viewerId,
  menu,
  cardapioHref,
  onOpenChange,
  onOrderCompleted,
  onRefresh,
}: {
  open: boolean
  call: PanelServiceCallDTO
  restaurantId: string
  viewerId: string
  menu: PanelMenuDTO
  cardapioHref: string
  onOpenChange: (open: boolean) => void
  onOrderCompleted: (message: string) => void
  onRefresh: () => Promise<unknown>
}) {
  const [itemsCount, setItemsCount] = useState(0)
  const [resolveConfirmationOpen, setResolveConfirmationOpen] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const isAssignee = call.status === "in_progress" && call.claimedBy === viewerId

  async function submitOrder(requestId: string, items: OrderItemInput[]) {
    const result = await recordPanelOrderAction({
      expectedRestaurantId: restaurantId,
      callId: call.id,
      requestId,
      fulfillmentType: "dine_in",
      tableNumber: null,
      customerName: null,
      items,
    })
    if (!result.ok && (result.code === "call_conflict" || result.code === "call_not_found")) {
      void onRefresh().catch(() => undefined)
    }
    return result
  }

  async function resolveCall() {
    if (!isAssignee || itemsCount > 0 || resolving) return
    setResolving(true)
    setResolveError(null)
    try {
      const result = await resolveServiceCallAction({ expectedRestaurantId: restaurantId, callId: call.id })
      if (result.ok) {
        setResolveConfirmationOpen(false)
        onOpenChange(false)
        void onRefresh().catch(() => undefined)
      } else {
        setResolveError(result.code === "not_assignee"
          ? "Somente a pessoa responsável pode concluir este chamado."
          : result.code === "session_expired"
          ? "Sua sessão expirou. Entre novamente para continuar."
          : result.code === "resolve_conflict"
          ? "Este atendimento já foi encerrado ou mudou de estado. A lista foi sincronizada."
          : "Não foi possível concluir o atendimento. Atualize os chamados e tente novamente.")
        if (result.code === "resolve_conflict") void onRefresh().catch(() => undefined)
      }
    } catch {
      setResolveError("A conexão falhou. O estado do atendimento será sincronizado novamente.")
      void onRefresh().catch(() => undefined)
    } finally {
      setResolving(false)
    }
  }

  const resolveAction = isAssignee ? (
    <Button type="button" variant="outline" disabled={itemsCount > 0 || resolving} onClick={() => setResolveConfirmationOpen(true)} className="hidden min-h-10 shrink-0 rounded-xl px-3 text-xs lg:inline-flex">
      {resolving ? <LuLoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <LuCheck aria-hidden="true" />}
      Encerrar
    </Button>
  ) : null
  const mobileResolveAction = isAssignee ? (
    <Button type="button" variant="outline" disabled={itemsCount > 0 || resolving} onClick={() => setResolveConfirmationOpen(true)} className="min-h-11 rounded-xl px-3 text-xs lg:hidden">
      {resolving ? <LuLoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <LuCheck aria-hidden="true" />}
      Concluir
    </Button>
  ) : null

  function onOrderRecorded(result: RecordPanelOrderResult) {
    const message = `Pedido de R$ ${formatMenuPriceCents(result.totalCents)} registrado na comanda da mesa ${call.tableNumber}. Chamado finalizado.`
    onOrderCompleted(message)
    void onRefresh().catch(() => undefined)
  }

  return (
    <MotionConfig reducedMotion="user">
      <OrderEntrySheet
        open={open}
        title={`Mesa ${call.tableNumber}`}
        subtitle={`Chamado aberto às ${dateLabel(call.createdAt)}${call.claimedAt ? ` · assumido às ${dateLabel(call.claimedAt)}` : ""}`}
        statusLabel="Em atendimento"
        menu={menu}
        cardapioHref={cardapioHref}
        canEdit={isAssignee}
        lockedMessage={isAssignee ? undefined : "Você pode consultar o cardápio. Só quem assumiu este chamado pode registrar o pedido."}
        failureMessage={callFailureMessage}
        headerActions={resolveAction}
        mobileFooterAction={mobileResolveAction}
        onOpenChange={onOpenChange}
        onSubmit={submitOrder}
        onOrderCompleted={onOrderRecorded}
        onItemsCountChange={setItemsCount}
      />

      <AlertDialog open={resolveConfirmationOpen} onOpenChange={setResolveConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar o atendimento da mesa {call.tableNumber}?</AlertDialogTitle>
            <AlertDialogDescription>A comanda continua disponível no Caixa. Você pode reabrir o atendimento gerando um novo chamado na mesa.</AlertDialogDescription>
          </AlertDialogHeader>
          {resolveError ? <p role="alert" className="rounded-xl bg-destructive/[0.06] px-3 py-2 text-xs leading-5 text-destructive">{resolveError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolving} className="min-h-10 rounded-xl">Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={resolving} onClick={(event) => { event.preventDefault(); void resolveCall() }} className="min-h-10 rounded-xl">
              {resolving ? <LuLoaderCircle aria-hidden="true" className="animate-spin" /> : null}{resolving ? "Encerrando…" : "Encerrar atendimento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionConfig>
  )
}
