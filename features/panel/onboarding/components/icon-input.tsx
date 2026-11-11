"use client"

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react"
import { useMemo } from "react"
import { Combobox } from "@base-ui/react"
import { Combobox as ComboboxRoot, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group"

type IconInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange"> & {
  id: string
  label: string
  icon: ReactNode
  value: string
  onChange: (value: string) => void
  error?: string
  description?: string
}

export function IconInput({ id, label, icon, value, onChange, error, description, ...inputProps }: IconInputProps) {
  const errorId = `${id}-error`
  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="h-11 rounded-lg bg-background/70" aria-invalid={Boolean(error) || undefined}>
        <InputGroupAddon align="inline-start"><InputGroupText>{icon}</InputGroupText></InputGroupAddon>
        <InputGroupInput
          {...inputProps}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : description ? `${id}-description` : undefined}
          className="h-11"
        />
      </InputGroup>
      {description ? <FieldDescription id={`${id}-description`}>{description}</FieldDescription> : null}
      <FieldError id={errorId} errors={error ? [{ message: error }] : []} />
    </Field>
  )
}

type IconTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "value" | "onChange"> & {
  id: string
  label: string
  icon: ReactNode
  value: string
  onChange: (value: string) => void
  error?: string
  description?: string
}

export function IconTextarea({ id, label, icon, value, onChange, error, description, ...textareaProps }: IconTextareaProps) {
  const errorId = `${id}-error`
  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id} className="flex items-center gap-2">{icon}{label}</FieldLabel>
      <InputGroup className="min-h-28 rounded-lg bg-background/70" aria-invalid={Boolean(error) || undefined}>
        <InputGroupTextarea
          {...textareaProps}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : description ? `${id}-description` : undefined}
          className="min-h-28 px-3 py-2.5"
        />
      </InputGroup>
      {description ? <FieldDescription id={`${id}-description`}>{description}</FieldDescription> : null}
      <FieldError id={errorId} errors={error ? [{ message: error }] : []} />
    </Field>
  )
}

export function IconCombobox({
  id,
  label,
  icon,
  value,
  options,
  onChange,
  placeholder = "Selecione uma opção",
  emptyMessage = "Nenhuma opção encontrada.",
  error,
}: {
  id: string
  label: string
  icon: ReactNode
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  error?: string
}) {
  const errorId = `${id}-error`
  const items = useMemo(
    () => Combobox.createItems(options, {
      getValue: (option) => option.value,
      getLabel: (option) => option.label,
    }),
    [options]
  )

  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <ComboboxRoot
        items={items}
        value={value}
        onValueChange={(next) => { onChange(typeof next === "string" ? next : "") }}
      >
        <ComboboxInput id={id} placeholder={placeholder} startAdornment={icon} showClear className="h-11 w-full rounded-lg bg-background/70" autoComplete="off" aria-invalid={Boolean(error) || undefined} aria-describedby={error ? errorId : undefined} />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {options.map((option) => (
              <ComboboxItem key={option.value} value={option.value}>{option.label}</ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
      <FieldError id={errorId} errors={error ? [{ message: error }] : []} />
    </Field>
  )
}
