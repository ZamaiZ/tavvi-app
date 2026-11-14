"use client"

import type { CSSProperties } from "react"
import { LuChevronRight, LuMessageSquareText } from "react-icons/lu"

import { PublicFeedbackForm } from "@/features/feedback/components/public-feedback-form"
import type { PublicThemeStyle } from "@/features/public-profile/theme"
import { PUBLIC_THEME_FONT_VARIABLES } from "@/features/public-profile/fonts"
import styles from "@/features/public-profile/styles/public-profile.module.css"

export function PublicFeedbackAction({
  slug,
  restaurantName,
  revealOrder,
  themeStyle,
}: {
  slug: string
  restaurantName: string
  revealOrder: number
  themeStyle: PublicThemeStyle
}) {
  const revealStyle = (order: number) => ({ "--reveal-delay": `${order * 45}ms` }) as CSSProperties

  return (
    <li className={`${styles.actionItem} ${styles.reveal}`} style={revealStyle(revealOrder)}>
      <PublicFeedbackForm
        slug={slug}
        restaurantName={restaurantName}
        themeStyle={themeStyle}
        trigger={(open) => (
          <button type="button" className={styles.action} onClick={open}>
            <span className={`${styles.actionIcon} ${styles.reveal}`} style={revealStyle(revealOrder + 1)} aria-hidden="true">
              <LuMessageSquareText />
            </span>
            <span className={`${styles.actionLabel} ${styles.reveal}`} style={revealStyle(revealOrder + 2)}>
              Deixar feedback anônimo
            </span>
            <LuChevronRight className={`${styles.actionChevron} ${styles.reveal}`} style={revealStyle(revealOrder + 3)} aria-hidden="true" />
          </button>
        )}
      />
    </li>
  )
}
