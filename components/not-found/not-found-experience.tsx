import Image from "next/image"
import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import styles from "./not-found-experience.module.css"

type NotFoundExperienceProps = {
  homeHref: string
  adminSignInHref: string
  panelSignInHref: string
}

export function NotFoundExperience({
  homeHref,
  adminSignInHref,
  panelSignInHref,
}: NotFoundExperienceProps) {
  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.content}>
        <header className={styles.header}>
          <Link className={styles.brand} href={homeHref} aria-label="Tavvi — início">
            <Image
              src="/brand/tavvi-wordmark-light.png"
              alt="Tavvi"
              width={420}
              height={152}
              className={styles.wordmarkLight}
              priority
            />
            <Image
              src="/brand/tavvi-wordmark-dark.png"
              alt="Tavvi"
              width={420}
              height={152}
              className={styles.wordmarkDark}
              priority
            />
          </Link>
          <div className={styles.headerActions}>
            <span className={styles.status}>
              <span className={styles.statusDot} aria-hidden="true" />
              NAVEGAÇÃO
            </span>
            <ThemeToggle />
          </div>
        </header>

        <section className={styles.hero} aria-labelledby="not-found-title">
          <p className={styles.eyebrow}>O caminho mudou</p>

          <div className={styles.number} aria-hidden="true">
            <span>4</span>
            <span>0</span>
            <span>4</span>
          </div>

          <h1 id="not-found-title" className={styles.title}>
            Esta página não foi encontrada.
          </h1>
          <p className={styles.description}>
            O endereço pode estar incorreto ou não estar mais disponível. Você pode voltar ao início ou escolher um acesso da Tavvi.
          </p>

          <div className={styles.actions}>
            <Link href={homeHref} className={styles.homeAction}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m3.75 10.5 8.25-6.75 8.25 6.75v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V10.5Z" />
                <path d="M9 20.25v-6.75h6v6.75" />
              </svg>
              Voltar ao início
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </span>
            </Link>

            <nav className={styles.accessLinks} aria-label="Acessos da Tavvi">
              <Link href={adminSignInHref} className={styles.accessLink}>
                <span className={styles.accessIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3.75 19.5 7v5.25c0 4.05-2.7 6.75-7.5 8.25-4.8-1.5-7.5-4.2-7.5-8.25V7L12 3.75Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </span>
                <span className={styles.accessCopy}>
                  <span className={styles.accessTitle}>Administração</span>
                  <span className={styles.accessDescription}>Entrar como administrador</span>
                </span>
                <span className={styles.accessArrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </span>
              </Link>

              <Link href={panelSignInHref} className={styles.accessLink}>
                <span className={styles.accessIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="4.75" width="16" height="14.5" rx="2.25" />
                    <path d="M4 9.25h16M8 14h3m-3 2.5h6" />
                  </svg>
                </span>
                <span className={styles.accessCopy}>
                  <span className={styles.accessTitle}>Painel do restaurante</span>
                  <span className={styles.accessDescription}>Entrar na área de gestão</span>
                </span>
                <span className={styles.accessArrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </span>
              </Link>
            </nav>
          </div>
        </section>

        <footer className={styles.footer}>
          <span className={styles.footerRule} aria-hidden="true" />
        </footer>
      </div>
    </main>
  )
}
