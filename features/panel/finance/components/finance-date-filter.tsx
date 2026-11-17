"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ptBR } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { LuCalendarDays, LuChevronDown } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function toDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`)
}

function toIsoDate(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`
}

function shiftDate(value: string, days: number) {
  const date = toDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(toDate(value))
}

export function FinanceDateFilter({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>(() => ({ from: toDate(from), to: toDate(to) }))

  useEffect(() => setRange({ from: toDate(from), to: toDate(to) }), [from, to])

  const selectedPreset = useMemo(() => {
    if (from === today && to === today) return "today"
    if (from === shiftDate(today, -6) && to === today) return "7d"
    if (from === shiftDate(today, -29) && to === today) return "30d"
    return "custom"
  }, [from, to, today])

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams({ from: nextFrom, to: nextTo })
    router.push(`${pathname}?${params.toString()}`)
  }

  function choosePreset(preset: "today" | "7d" | "30d") {
    const days = preset === "today" ? 0 : preset === "7d" ? 6 : 29
    apply(shiftDate(today, -days), today)
    setOpen(false)
  }

  function selectRange(next: DateRange | undefined) {
    setRange(next)
    if (!next?.from || !next.to) return
    const nextFrom = toIsoDate(next.from)
    const nextTo = toIsoDate(next.to)
    const days = (Date.parse(`${nextTo}T00:00:00Z`) - Date.parse(`${nextFrom}T00:00:00Z`)) / 86_400_000
    if (days > 366) return
    apply(nextFrom, nextTo)
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-border/70 bg-muted/40 p-1" aria-label="Período do relatório">
        {([ ["today", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"] ] as const).map(([value, label]) => <Button key={value} type="button" variant="ghost" aria-pressed={selectedPreset === value} onClick={() => choosePreset(value)} className={`min-h-9 rounded-lg px-3 text-xs ${selectedPreset === value ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground"}`}>{label}</Button>)}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button type="button" variant="outline" aria-label="Selecionar intervalo de datas" aria-expanded={open} className="min-h-11 min-w-[13rem] justify-between rounded-xl bg-background px-3.5 text-xs font-medium" />}>
          <span className="inline-flex items-center gap-2"><LuCalendarDays aria-hidden="true" className="size-4 text-primary" />{dateLabel(from)} – {dateLabel(to)}</span>
          <LuChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto rounded-2xl border-border/70 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
          <Calendar mode="range" selected={range} onSelect={selectRange} numberOfMonths={1} locale={ptBR} disabled={{ after: toDate(today) }} />
          <p className="px-3 pb-2 text-[0.68rem] text-muted-foreground">Escolha o primeiro e o último dia do período.</p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
