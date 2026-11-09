import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"

import { ThemeToggle } from "@/components/theme-toggle"
import { RestaurantFinder } from "@/features/public-profile/components/restaurant-finder"
import styles from "./page.module.css"

export const metadata: Metadata = {
  title: "Tavvi — Cardápio digital",
  description:
    "Encontre restaurantes ativos pelo nome, tipo de cozinha ou endereço e abra sua apresentação digital.",
}

export default function Page() {
  return (
    <main className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-background px-6 py-16 text-center text-foreground">
      <div aria-hidden="true" className={styles.rootAmbient} />
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        <div className="flex items-center justify-center gap-2.5">
          <Image
            src="/brand/tavvi-wordmark-light.png"
            alt="Tavvi"
            width={420}
            height={152}
            className="h-5 w-auto dark:hidden"
          />
          <Image
            src="/brand/tavvi-wordmark-dark.png"
            alt="Tavvi"
            width={420}
            height={152}
            className="hidden h-5 w-auto dark:block relative top-[-2px]"
          />
          <span
            aria-hidden="true"
            className="text-xs text-foreground/60"
          >
            ·
          </span>
          <span className="text-xs font-medium tracking-[0.16em] text-foreground">
            CARDÁPIO DIGITAL
          </span>
        </div>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          O cardápio está na mesa
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-foreground">
          Descubra restaurantes ativos e abra sua apresentação digital.
        </p>
        <RestaurantFinder />
        <Link href="/painel/entrar" className="mt-8 inline-block text-sm font-medium underline underline-offset-4 hover:text-primary">Acessar painel do restaurante</Link>
      </div>
    </main>
  )
}
