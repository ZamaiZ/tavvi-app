import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"

import styles from "./page.module.css"

export const metadata: Metadata = {
  title: "Tavvi — Cardápio digital",
  description:
    "Cardápios digitais acessíveis por QR Code e NFC, sem precisar instalar nada.",
}

export default function Page() {
  return (
    <main className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-background px-6 py-16 text-center text-foreground">
      <div aria-hidden="true" className={styles.rootAmbient} />

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
          Acesse pelo QR Code ou NFC do restaurante, sem instalar nada.
        </p>
        <Link href="/painel/entrar" className="mt-8 inline-block text-sm font-medium underline underline-offset-4 hover:text-primary">Acessar painel do restaurante</Link>
      </div>
    </main>
  )
}
