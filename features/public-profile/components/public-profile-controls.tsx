"use client"

import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { RiComputerLine, RiMoonLine, RiSunLine } from "react-icons/ri"

import styles from "@/features/public-profile/styles/public-profile.module.css"

type MenuAppearance = "system" | "light" | "dark"

const MENU_THEME_KEY = "tema-cardapio"
type RevealStyle = CSSProperties & { "--reveal-delay": string }

const appearanceOptions: Record<
  MenuAppearance,
  { label: string; Icon: typeof RiComputerLine; next: MenuAppearance }
> = {
  system: { label: "Sistema", Icon: RiComputerLine, next: "light" },
  light: { label: "Claro", Icon: RiSunLine, next: "dark" },
  dark: { label: "Escuro", Icon: RiMoonLine, next: "system" },
}

function isMenuAppearance(value: string | undefined): value is MenuAppearance {
  return value === "system" || value === "light" || value === "dark"
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function revealStyle(order: number) {
  return { "--reveal-delay": `${order * 45}ms` } as RevealStyle
}

export function PublicAppearanceToggle({ revealOrder }: { revealOrder: number }) {
  const [appearance, setAppearance] = useState<MenuAppearance>("system")

  useEffect(() => {
    const storedAppearance = document.documentElement.dataset.menuAppearance
    if (isMenuAppearance(storedAppearance)) setAppearance(storedAppearance)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return
      if (
        event.code !== "KeyT" ||
        !event.ctrlKey ||
        !event.altKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const next = appearanceOptions[appearance].next
      setAppearance(next)
      document.documentElement.dataset.menuAppearance = next
      try {
        window.localStorage.setItem(MENU_THEME_KEY, next)
      } catch {
        // The selection still applies for this visit if storage is unavailable.
      }
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [appearance])

  function cycleAppearance() {
    const next = appearanceOptions[appearance].next
    setAppearance(next)
    document.documentElement.dataset.menuAppearance = next

    try {
      window.localStorage.setItem(MENU_THEME_KEY, next)
    } catch {
      // The selection still applies for this visit if storage is unavailable.
    }
  }

  const { label, Icon, next } = appearanceOptions[appearance]

  return (
    <button
      type="button"
      className={`${styles.appearanceToggle} ${styles.reveal}`}
      style={revealStyle(revealOrder)}
      onClick={cycleAppearance}
      aria-label={`Tema: ${label}. Ativar ${appearanceOptions[next].label}`}
      title={`Tema: ${label}`}
    >
      <Icon aria-hidden="true" />
    </button>
  )
}

function descriptionPreview(value: string): string {
  const excerpt = value.slice(0, 179)
  const wordBoundary = excerpt.lastIndexOf(" ")
  const preview = wordBoundary >= 0 ? excerpt.slice(0, wordBoundary) : excerpt
  return `${preview.trimEnd()}…`
}

export function ExpandableDescription({
  description,
  id,
  revealOrder,
}: {
  description: string
  id: string
  revealOrder: number
}) {
  const [expanded, setExpanded] = useState(false)
  const isExpandable = description.length > 180

  return (
    <div className={`${styles.descriptionBlock} ${styles.reveal}`} style={revealStyle(revealOrder)}>
      <p className={styles.description} id={id}>
        {expanded || !isExpandable ? description : descriptionPreview(description)}
      </p>
      {isExpandable ? (
        <button
          type="button"
          className={`${styles.descriptionToggle} ${styles.reveal}`}
          style={revealStyle(revealOrder + 1)}
          onClick={() => setExpanded((current) => !current)}
          aria-controls={id}
          aria-expanded={expanded}
        >
          {expanded ? "Exibir menos" : "Exibir mais"}
        </button>
      ) : null}
    </div>
  )
}
