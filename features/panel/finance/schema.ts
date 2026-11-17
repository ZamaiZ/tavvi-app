import { z } from "zod"

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
})

export const financeDateRangeSchema = z.object({ from: date, to: date }).strict().refine((range) => {
  const difference = (Date.parse(`${range.to}T00:00:00.000Z`) - Date.parse(`${range.from}T00:00:00.000Z`)) / 86_400_000
  return difference >= 0 && difference <= 366
}, { path: ["to"], message: "invalid_finance_date_range" })
