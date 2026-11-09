"use client"

import * as React from "react"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react"
import { useTheme } from "next-themes"
import { LuMoon, LuSun, LuSunMoon } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const shouldReduceMotion = useReducedMotion()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const targetTheme = resolvedTheme === "dark" ? "light" : "dark"
  const label = mounted
    ? `Mudar para tema ${targetTheme === "dark" ? "escuro" : "claro"}`
    : "Alternar tema claro e escuro"

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      disabled={!mounted || !resolvedTheme}
      onClick={() => setTheme(targetTheme)}
      className={cn(
        "min-h-11 min-w-11 rounded-full border-border/70 bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted/80",
        className,
      )}
    >
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait" initial={false}>
          {mounted && resolvedTheme ? (
            <motion.span
              key={resolvedTheme}
              aria-hidden="true"
              initial={shouldReduceMotion ? false : { opacity: 0, rotate: -28, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 28, scale: 0.8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
              className="inline-flex size-4 items-center justify-center"
            >
              {resolvedTheme === "dark" ? (
                <LuSun className="size-4" />
              ) : (
                <LuMoon className="size-4" />
              )}
            </motion.span>
          ) : (
            <span aria-hidden="true" className="inline-flex size-4 items-center justify-center">
              <LuSunMoon className="size-4" />
            </span>
          )}
        </AnimatePresence>
      </MotionConfig>
    </Button>
  )
}
