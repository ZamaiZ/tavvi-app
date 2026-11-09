import {
  panelThemeSchema,
  type PanelTheme,
} from "@/features/panel/onboarding/schema"
import { PANEL_THEME_PRESETS } from "@/features/panel/onboarding/identity-options"

type ThemePresetId = PanelTheme["preset"]

type ThemeFace = {
  base: string
  ink: string
  muted: string
  line: string
  surface: string
  accent: string
  onAccent: string
  chip: string
}

type ThemePresetVisual = {
  darkBase: string
  darkAccent: string
  displayFont: string
  textFont: string
  blockRadius: string
  photoRadius: string
}

export type PublicThemeStyle = Record<string, string>

export type ResolvedPublicTheme = {
  presetId: ThemePresetId
  density: PanelTheme["density"]
  style: PublicThemeStyle
}

const VISUALS: Record<ThemePresetId, ThemePresetVisual> = {
  brasa: {
    darkBase: "#0a0908",
    darkAccent: "#f0a154",
    displayFont: "var(--pf-anton), sans-serif",
    textFont: "var(--font-sans), sans-serif",
    blockRadius: "4px",
    photoRadius: "4px",
  },
  forno: {
    darkBase: "#17110d",
    darkAccent: "#e0603f",
    displayFont: "var(--pf-bitter), serif",
    textFont: "var(--font-sans), sans-serif",
    blockRadius: "8px",
    photoRadius: "8px",
  },
  grao: {
    darkBase: "#17140f",
    darkAccent: "#c59a6d",
    displayFont: "var(--pf-fraunces), serif",
    textFont: "var(--font-sans), sans-serif",
    blockRadius: "14px",
    photoRadius: "999px",
  },
  sal: {
    darkBase: "#131312",
    darkAccent: "#b5b1a8",
    displayFont: "var(--pf-cormorant), serif",
    textFont: "var(--font-sans), sans-serif",
    blockRadius: "0px",
    photoRadius: "0px",
  },
  horta: {
    darkBase: "#0f1a13",
    darkAccent: "#4ec988",
    displayFont: "var(--font-heading), sans-serif",
    textFont: "var(--font-heading), sans-serif",
    blockRadius: "22px",
    photoRadius: "999px",
  },
  neon: {
    darkBase: "#05050a",
    darkAccent: "#16e0a3",
    displayFont: "var(--pf-space), sans-serif",
    textFont: "var(--pf-space), sans-serif",
    blockRadius: "2px",
    photoRadius: "2px",
  },
  nori: {
    darkBase: "#131314",
    darkAccent: "#e04a52",
    displayFont: "var(--pf-zen), sans-serif",
    textFont: "var(--font-sans), sans-serif",
    blockRadius: "2px",
    photoRadius: "2px",
  },
  confeito: {
    darkBase: "#171013",
    darkAccent: "#f07fa4",
    displayFont: "var(--pf-quicksand), sans-serif",
    textFont: "var(--pf-quicksand), sans-serif",
    blockRadius: "24px",
    photoRadius: "18px",
  },
}

type Rgb = { r: number; g: number; b: number }

function rgbFromHex(hex: string): Rgb {
  const value = hex.replace("#", "")
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function hexFromRgb({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0")
  return "#" + channel(r) + channel(g) + channel(b)
}

function mixHex(from: string, to: string, amount: number): string {
  const source = rgbFromHex(from)
  const target = rgbFromHex(to)
  return hexFromRgb({
    r: source.r + (target.r - source.r) * amount,
    g: source.g + (target.g - source.g) * amount,
    b: source.b + (target.b - source.b) * amount,
  })
}

function linearChannel(value: number): number {
  const normalized = value / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const color = rgbFromHex(hex)
  return (
    linearChannel(color.r) * 0.2126 +
    linearChannel(color.g) * 0.7152 +
    linearChannel(color.b) * 0.0722
  )
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function contrastText(background: string): string {
  return contrastRatio("#000000", background) >= contrastRatio("#ffffff", background)
    ? "#000000"
    : "#ffffff"
}

function fitAgainstBackground(color: string, background: string): string {
  if (contrastRatio(color, background) >= 4.5) return color

  const blackContrast = contrastRatio("#000000", background)
  const whiteContrast = contrastRatio("#ffffff", background)
  const target = blackContrast >= whiteContrast ? "#000000" : "#ffffff"
  if (contrastRatio(target, background) < 4.5) return target

  let low = 0
  let high = 1
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2
    const candidate = mixHex(color, target, middle)
    if (contrastRatio(candidate, background) >= 4.5) high = middle
    else low = middle
  }
  return mixHex(color, target, high)
}

function fitAccentText(accent: string): { accent: string; onAccent: string } {
  let adjusted = accent
  let foreground = contrastText(adjusted)
  if (contrastRatio(foreground, adjusted) >= 4.5) {
    return { accent: adjusted, onAccent: foreground }
  }

  const target = foreground === "#000000" ? "#ffffff" : "#000000"
  let low = 0
  let high = 1
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2
    const candidate = mixHex(adjusted, target, middle)
    if (contrastRatio(foreground, candidate) >= 4.5) high = middle
    else low = middle
  }
  adjusted = mixHex(adjusted, target, high)
  foreground = contrastText(adjusted)
  return { accent: adjusted, onAccent: foreground }
}

function mutedColor(ink: string, base: string): string {
  let low = 0
  let high = 1
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2
    const candidate = mixHex(ink, base, middle)
    if (contrastRatio(candidate, base) >= 4.5) low = middle
    else high = middle
  }
  return mixHex(ink, base, low)
}

function resolveFace(base: string, rawAccent: string): ThemeFace {
  const ink = contrastText(base)
  const accent = fitAccentText(fitAgainstBackground(rawAccent, base))

  return {
    base,
    ink,
    muted: mutedColor(ink, base),
    line: mixHex(ink, base, 0.84),
    surface: mixHex(base, ink, 0.035),
    accent: accent.accent,
    onAccent: accent.onAccent,
    chip: mixHex(base, ink, 0.06),
  }
}

function fallbackChoice(): PanelTheme {
  return {
    preset: "grao",
    base: null,
    accent: null,
    density: "confortavel",
  }
}

export function resolvePublicTheme(raw: unknown): ResolvedPublicTheme {
  const parsed = panelThemeSchema.safeParse(raw ?? {})
  const choice = parsed.success ? parsed.data : fallbackChoice()
  const selectedPreset = PANEL_THEME_PRESETS[choice.preset]
  const visual = VISUALS[choice.preset]
  const selectedAccent = choice.accent ?? selectedPreset.accent
  const lightBase = choice.base ?? selectedPreset.base
  const light = resolveFace(lightBase, selectedAccent)
  const darkBase = choice.base
    ? mixHex(visual.darkBase, choice.base, 0.14)
    : visual.darkBase
  const dark = resolveFace(darkBase, choice.accent ?? visual.darkAccent)

  return {
    presetId: choice.preset,
    density: choice.density,
    style: {
      "--profile-light-base": light.base,
      "--profile-light-ink": light.ink,
      "--profile-light-muted": light.muted,
      "--profile-light-line": light.line,
      "--profile-light-surface": light.surface,
      "--profile-light-accent": light.accent,
      "--profile-light-on-accent": light.onAccent,
      "--profile-light-chip": light.chip,
      "--profile-dark-base": dark.base,
      "--profile-dark-ink": dark.ink,
      "--profile-dark-muted": dark.muted,
      "--profile-dark-line": dark.line,
      "--profile-dark-surface": dark.surface,
      "--profile-dark-accent": dark.accent,
      "--profile-dark-on-accent": dark.onAccent,
      "--profile-dark-chip": dark.chip,
      "--profile-block-radius": visual.blockRadius,
      "--profile-photo-radius": visual.photoRadius,
      "--profile-display-font": visual.displayFont,
      "--profile-text-font": visual.textFont,
    },
  }
}
