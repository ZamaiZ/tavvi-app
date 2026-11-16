"use client"

import type { ChangeEvent } from "react"
import { LuCircleDollarSign } from "react-icons/lu"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"

import { maskPaymentAmountInput } from "../lib/currency"

export function PaymentAmountInput({
  id,
  label,
  value,
  onValueChange,
  onBlur,
  disabled,
  error,
  description,
}: {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  error?: string
  description?: string
}) {
  const errorId = id + "-error"
  const descriptionId = id + "-description"

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const cursor = input.selectionStart ?? input.value.length
    const digitsBeforeCursor = input.value.slice(0, cursor).replace(/\D/g, "").length
    const nextValue = maskPaymentAmountInput(input.value)
    onValueChange(nextValue)

    requestAnimationFrame(() => {
      if (document.activeElement !== input) return
      let position = 0
      let digits = 0
      while (position < nextValue.length && digits < digitsBeforeCursor) {
        if (/\d/.test(nextValue[position])) digits += 1
        position += 1
      }
      input.setSelectionRange(position, position)
    })
  }

  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="h-11 rounded-xl bg-background/80" aria-invalid={Boolean(error) || undefined}>
        <InputGroupAddon align="inline-start">
          <InputGroupText className="gap-1.5">
            <LuCircleDollarSign aria-hidden="true" />
            <span>R$</span>
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          inputMode="numeric"
          autoComplete="off"
          maxLength={22}
          placeholder="0,00"
          value={value}
          disabled={disabled}
          onChange={handleChange}
          onBlur={onBlur}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : description ? descriptionId : undefined}
          className="h-11 text-right tabular-nums"
        />
      </InputGroup>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      <FieldError id={errorId} errors={error ? [{ message: error }] : []} />
    </Field>
  )
}
