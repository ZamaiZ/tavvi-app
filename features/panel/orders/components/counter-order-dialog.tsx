"use client"

import { useMemo, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { LuArrowRight, LuPackage, LuUserRound, LuUtensils } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PanelMenuDTO } from "@/features/panel/menu/model"
import { formatMenuPriceCents } from "@/features/panel/menu/lib/currency"
import { recordPanelOrderAction } from "@/features/panel/orders/actions"
import { OrderEntrySheet } from "@/features/panel/orders/components/order-entry-sheet"
import type { OrderItemInput, PanelOrderFailureCode, RecordPanelOrderResult } from "@/features/panel/orders/model"

type FulfillmentType = "dine_in" | "takeaway"

function counterFailureMessage(code: PanelOrderFailureCode) {
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente para registrar o pedido."
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize o Caixa antes de continuar."
  if (code === "forbidden") return "Sua conta não tem acesso a este restaurante."
  if (code === "invalid_input") return "Revise o modo de consumo, a mesa, o nome e os itens do pedido."
  if (code === "item_not_available" || code === "variant_not_available") return "Um item ou uma variação ficou indisponível. Revise o pedido e tente novamente."
  if (code === "variant_required") return "Escolha uma variação para cada item que exige essa seleção."
  if (code === "request_conflict") return "Este envio já foi associado a outro pedido. Atualize o Caixa e inicie um novo pedido."
  return "Não foi possível registrar o pedido. Confira a conexão e tente novamente."
}

export function CounterOrderDialog({
  open,
  restaurantId,
  menu,
  cardapioHref,
  onOpenChange,
  onOrderCompleted,
}: {
  open: boolean
  restaurantId: string
  menu: PanelMenuDTO
  cardapioHref: string
  onOpenChange: (open: boolean) => void
  onOrderCompleted: (message: string) => void
}) {
  const reducedMotion = useReducedMotion() === true
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType | null>(null)
  const [tableInput, setTableInput] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [prepared, setPrepared] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const parsedTableNumber = useMemo(() => {
    const value = tableInput.trim()
    if (!value) return { valid: true, number: null }
    if (!/^\d+$/.test(value)) return { valid: false, number: null }
    const number = Number(value)
    return Number.isSafeInteger(number) && number > 0 && number <= 2_147_483_647
      ? { valid: true, number }
      : { valid: false, number: null }
  }, [tableInput])

  const tableNumber = fulfillmentType === "dine_in" ? parsedTableNumber.number : null
  const normalizedName = customerName.trim() || null
  const title = tableNumber === null ? "Novo pedido de balcão" : "Mesa " + tableNumber
  const subtitle = (fulfillmentType === "takeaway" ? "Para viagem" : "Comer no local") + " · pedido direto no Caixa"
  const statusLabel = fulfillmentType === "takeaway" ? "Para viagem" : "No local"

  function selectFulfillment(value: FulfillmentType) {
    setFulfillmentType(value)
    if (value === "takeaway") setTableInput("")
    setContextError(null)
  }

  function continueToMenu() {
    if (!fulfillmentType || !parsedTableNumber.valid || customerName.trim().length > 120) {
      setContextError("Escolha como o pedido será consumido e confira os dados informados.")
      return
    }
    setContextError(null)
    setPrepared(true)
  }

  async function submitOrder(requestId: string, items: OrderItemInput[]) {
    return recordPanelOrderAction({
      expectedRestaurantId: restaurantId,
      callId: null,
      requestId,
      fulfillmentType: fulfillmentType ?? "dine_in",
      tableNumber,
      customerName: normalizedName,
      items,
    })
  }

  function onOrderRecorded(result: RecordPanelOrderResult) {
    const location = tableNumber !== null
      ? "Comanda da mesa " + tableNumber + " atualizada."
      : "Comanda de balcão #" + (result.displayNumber ?? "—") + " aberta."
    onOrderCompleted("Pedido de R$ " + formatMenuPriceCents(result.totalCents) + " registrado. " + location)
  }

  const preparationStep = (
    <div className="space-y-6 rounded-3xl border border-border/70 bg-card/85 p-5 shadow-lg shadow-black/[0.035] sm:p-8">
      <div className="space-y-2">
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/[0.06] px-3 py-1 text-[0.65rem] font-semibold tracking-wide text-primary">NOVO PEDIDO</Badge>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Como será consumido?</h2>
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">Escolha o modo e, se estiver no local, informe a mesa. O pedido ficará em aberto no Caixa para pagamento e encerramento.</p>
      </div>

      <div role="group" aria-label="Modo de consumo" className="grid gap-3 sm:grid-cols-2">
        <motion.button
          type="button"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.2, delay: reducedMotion ? 0 : 0.035 }}
          whileTap={{ scale: 0.985 }}
          aria-pressed={fulfillmentType === "dine_in"}
          onClick={() => selectFulfillment("dine_in")}
          className={"flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " + (fulfillmentType === "dine_in" ? "border-primary/40 bg-primary/[0.06] shadow-sm" : "border-border/70 bg-background/70 hover:border-primary/25 hover:bg-muted/30")}
        >
          <motion.span initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0.12 : 0.18, delay: reducedMotion ? 0 : 0.11 }} className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/[0.09] text-primary"><LuUtensils aria-hidden="true" className="size-5" /></motion.span>
          <span><span className="block text-sm font-semibold">Comer no local</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Com mesa ou uma comanda numerada de balcão.</span></span>
        </motion.button>
        <motion.button
          type="button"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.2, delay: reducedMotion ? 0 : 0.075 }}
          whileTap={{ scale: 0.985 }}
          aria-pressed={fulfillmentType === "takeaway"}
          onClick={() => selectFulfillment("takeaway")}
          className={"flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " + (fulfillmentType === "takeaway" ? "border-primary/40 bg-primary/[0.06] shadow-sm" : "border-border/70 bg-background/70 hover:border-primary/25 hover:bg-muted/30")}
        >
          <motion.span initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0.12 : 0.18, delay: reducedMotion ? 0 : 0.15 }} className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/[0.09] text-primary"><LuPackage aria-hidden="true" className="size-5" /></motion.span>
          <span><span className="block text-sm font-semibold">Para viagem</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Uma comanda numerada para identificar este pedido.</span></span>
        </motion.button>
      </div>

      <div className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
        {fulfillmentType === "dine_in" ? (
          <div className="space-y-2">
            <Label htmlFor="counter-order-table">Mesa <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input id="counter-order-table" value={tableInput} onChange={(event) => { setTableInput(event.target.value); setContextError(null) }} inputMode="numeric" placeholder="Ex.: 12" aria-invalid={!parsedTableNumber.valid} aria-describedby="counter-order-table-hint" className="h-11 rounded-xl bg-background" />
            <p id="counter-order-table-hint" className="text-xs leading-5 text-muted-foreground">Mesa sem identificador também pode ser informada.</p>
          </div>
        ) : <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-3.5 py-3 text-xs leading-5 text-muted-foreground"><LuPackage aria-hidden="true" className="size-4 shrink-0 text-primary" />Sem mesa: será criada uma comanda exclusiva com número gerado.</div>}
        <div className="space-y-2">
          <Label htmlFor="counter-order-customer"><span className="inline-flex items-center gap-1.5"><LuUserRound aria-hidden="true" className="size-3.5" />Nome <span className="font-normal text-muted-foreground">(opcional)</span></span></Label>
          <Input id="counter-order-customer" value={customerName} onChange={(event) => { setCustomerName(event.target.value.slice(0, 120)); setContextError(null) }} maxLength={120} placeholder="Nome para identificar o pedido" className="h-11 rounded-xl bg-background" />
          <p className="text-xs leading-5 text-muted-foreground">{customerName.length}/120 caracteres</p>
        </div>
      </div>

      {contextError ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs leading-5 text-destructive">{contextError}</p> : null}
      <Button type="button" disabled={!fulfillmentType || !parsedTableNumber.valid} onClick={continueToMenu} className="min-h-12 w-full rounded-xl font-semibold shadow-sm sm:w-auto sm:min-w-64">
        Continuar para o cardápio<LuArrowRight aria-hidden="true" />
      </Button>
    </div>
  )

  return (
    <OrderEntrySheet
      open={open}
      title={prepared ? title : "Novo pedido"}
      subtitle={prepared ? subtitle + (normalizedName ? " · " + normalizedName : "") : "Defina o modo de consumo e a identificação do pedido."}
      statusLabel={prepared ? statusLabel : undefined}
      menu={menu}
      cardapioHref={cardapioHref}
      canEdit={prepared}
      lockedMessage={prepared ? undefined : "Defina o contexto do pedido para continuar."}
      failureMessage={counterFailureMessage}
      preparationStep={preparationStep}
      isPrepared={prepared}
      onEditContext={() => { setContextError(null); setPrepared(false) }}
      onOpenChange={onOpenChange}
      onSubmit={submitOrder}
      onOrderCompleted={onOrderRecorded}
    />
  )
}
