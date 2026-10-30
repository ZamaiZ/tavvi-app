"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (!event.ctrlKey || !event.altKey || event.metaKey || event.shiftKey) {
        return
      }

      if (event.key?.toLowerCase() !== "t") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      event.preventDefault()
      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}

function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  React.useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") {
      return
    }

    const color = resolvedTheme === "dark" ? "#0D0C0A" : "#FFFFFF"
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.content = color
      })
  }, [resolvedTheme])

  return null
}

export { ThemeProvider }
