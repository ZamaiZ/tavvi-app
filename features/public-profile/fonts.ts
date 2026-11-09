import {
  Anton,
  Bitter,
  Cormorant_Garamond,
  Fraunces,
  Quicksand,
  Space_Grotesk,
  Zen_Kaku_Gothic_New,
} from "next/font/google"

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--pf-anton",
  preload: false,
  display: "swap",
})

const bitter = Bitter({
  subsets: ["latin"],
  variable: "--pf-bitter",
  preload: false,
  display: "swap",
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--pf-cormorant",
  preload: false,
  display: "swap",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--pf-fraunces",
  preload: false,
  display: "swap",
})

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--pf-quicksand",
  preload: false,
  display: "swap",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--pf-space",
  preload: false,
  display: "swap",
})

const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--pf-zen",
  preload: false,
  display: "swap",
})

export const PUBLIC_THEME_FONT_VARIABLES = [
  anton.variable,
  bitter.variable,
  cormorant.variable,
  fraunces.variable,
  quicksand.variable,
  spaceGrotesk.variable,
  zenKaku.variable,
].join(" ")
