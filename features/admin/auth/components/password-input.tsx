"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { LuEye, LuEyeOff, LuLockKeyhole } from "react-icons/lu"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"

type PasswordInputProps = {
  id: string
  name: string
  label: string
  autoComplete: "current-password" | "new-password"
  errors?: string[]
  minLength?: number
  required?: boolean
}

export function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  errors = [],
  minLength,
  required = true,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const errorId = id + "-error"
  const hasError = errors.length > 0

  return (
    <Field data-invalid={hasError || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup
        className="h-11 rounded-lg bg-background/70"
        aria-invalid={hasError || undefined}
      >
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <LuLockKeyhole aria-hidden="true" />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className="h-11"
        />
        <InputGroupAddon align="inline-end">
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <InputGroupButton
              aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={visible}
              className="mr-1 text-muted-foreground"
              onClick={() => setVisible((current) => !current)}
              size="icon-sm"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={visible ? "visible" : "hidden"}
                  initial={
                    shouldReduceMotion
                      ? false
                      : { opacity: 0, scale: 0.72, rotate: -24 }
                  }
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 0, scale: 0.72, rotate: 24 }
                  }
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.16,
                    ease: "easeOut",
                  }}
                  className="flex"
                >
                  {visible ? (
                    <LuEyeOff aria-hidden="true" />
                  ) : (
                    <LuEye aria-hidden="true" />
                  )}
                </motion.span>
              </AnimatePresence>
            </InputGroupButton>
          </motion.div>
        </InputGroupAddon>
      </InputGroup>
      <FieldError
        id={errorId}
        errors={errors.map((message) => ({ message }))}
      />
    </Field>
  )
}
