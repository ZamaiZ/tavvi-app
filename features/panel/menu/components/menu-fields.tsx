"use client"

import { useMemo, type ChangeEvent, type ComponentProps, type ReactNode } from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"
import { LuCircleDollarSign } from "react-icons/lu"

import {
  Combobox as ComboboxRoot,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { maskMenuPriceInput, MENU_PRICE_INPUT_DIGIT_LIMIT } from "../lib/currency"

export type MenuComboboxOption = {
  value: string
  label: string
  badge?: string
}

export function MenuComboboxField({
  id,
  value,
  options,
  onValueChange,
  icon,
  placeholder,
  emptyMessage = "Nenhuma opção encontrada.",
  ariaLabel,
  ariaInvalid,
  className,
}: {
  id: string
  value: string
  options: readonly MenuComboboxOption[]
  onValueChange: (value: string) => void
  icon: ReactNode
  placeholder: string
  emptyMessage?: string
  ariaLabel?: string
  ariaInvalid?: boolean
  className?: string
}) {
  const items = useMemo(
    () => ComboboxPrimitive.createItems(options, {
      getValue: (option) => option.value,
      getLabel: (option) => option.label,
    }),
    [options]
  )

  return (
    <ComboboxRoot
      items={items}
      value={value || null}
      onValueChange={(next) => { if (typeof next === "string") onValueChange(next) }}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        placeholder={placeholder}
        startAdornment={icon}
        className={cn("h-9 w-full bg-background/70", className)}
        autoComplete="off"
      />
      <ComboboxContent className="border border-border/70 bg-popover/95 shadow-xl">
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {options.map((option) => (
            <ComboboxItem key={option.value} value={option.value} className="justify-between">
              <span className="truncate">{option.label}</span>
              {option.badge ? <span className="ml-2 shrink-0 text-[0.625rem] text-muted-foreground">{option.badge}</span> : null}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </ComboboxRoot>
  )
}

type MenuIconInputProps = Omit<ComponentProps<"input">, "onChange" | "value" | "className"> & {
  icon: ReactNode
  value: string
  onValueChange: (value: string) => void
  className?: string
  inputClassName?: string
}

export function MenuIconInput({ icon, value, onValueChange, className, inputClassName, ...props }: MenuIconInputProps) {
  return (
    <InputGroup className={cn("h-9 bg-background/70", className)}>
      <InputGroupAddon align="inline-start"><InputGroupText>{icon}</InputGroupText></InputGroupAddon>
      <InputGroupInput
        {...props}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={inputClassName}
      />
    </InputGroup>
  )
}

type MenuIconTextareaProps = Omit<ComponentProps<"textarea">, "onChange" | "value" | "className"> & {
  icon: ReactNode
  value: string
  onValueChange: (value: string) => void
  className?: string
  textareaClassName?: string
}

export function MenuIconTextarea({ icon, value, onValueChange, className, textareaClassName, ...props }: MenuIconTextareaProps) {
  return (
    <InputGroup className={cn("min-h-20 items-start bg-background/70", className)}>
      <InputGroupAddon align="inline-start" className="pt-2.5"><InputGroupText>{icon}</InputGroupText></InputGroupAddon>
      <InputGroupTextarea
        {...props}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("min-h-20", textareaClassName)}
      />
    </InputGroup>
  )
}

type MenuPriceInputProps = Omit<ComponentProps<"input">, "onChange" | "value" | "className" | "inputMode"> & {
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function MenuPriceInput({ value, onValueChange, className, ...props }: MenuPriceInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const cursor = input.selectionStart ?? input.value.length
    const digitsBeforeCursor = input.value.slice(0, cursor).replace(/\D/g, "").length
    const rawDigitCount = input.value.replace(/\D/g, "").length
    const nextValue = maskMenuPriceInput(input.value)
    const nextDigitCount = nextValue.replace(/\D/g, "").length
    const addedLeadingZeros = Math.max(0, nextDigitCount - Math.min(rawDigitCount, MENU_PRICE_INPUT_DIGIT_LIMIT))
    const targetDigitCount = Math.min(digitsBeforeCursor, nextDigitCount) + addedLeadingZeros
    onValueChange(nextValue)

    requestAnimationFrame(() => {
      if (document.activeElement !== input) return
      let position = 0
      let digits = 0
      while (position < nextValue.length && digits < targetDigitCount) {
        if (/\d/.test(nextValue[position])) digits += 1
        position += 1
      }
      input.setSelectionRange(position, position)
    })
  }

  return (
    <InputGroup className={cn("h-9 bg-background/70", className)}>
      <InputGroupAddon align="inline-start">
        <InputGroupText className="gap-1.5"><LuCircleDollarSign aria-hidden="true" /><span>R$</span></InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        {...props}
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        placeholder="0,00"
        value={value}
        onChange={handleChange}
      />
    </InputGroup>
  )
}
