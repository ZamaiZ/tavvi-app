import type { OrderDraftLine } from "../model"

export function getOrderLineTotalCents(line: Pick<OrderDraftLine, "quantity" | "unitPriceCents" | "additions">) {
  const additionsPerUnit = line.additions.reduce((total, addition) => total + addition.quantity * addition.unitPriceCents, 0)
  return line.quantity * (line.unitPriceCents + additionsPerUnit)
}

export function getOrderTotalCents(lines: OrderDraftLine[]) {
  return lines.reduce((total, line) => total + getOrderLineTotalCents(line), 0)
}
