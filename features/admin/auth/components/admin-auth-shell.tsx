"use client"

import Image from "next/image"
import type { ReactNode } from "react"
import { MotionConfig, motion, useReducedMotion } from "motion/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  authItemVariants,
  authStaggerVariants,
} from "@/features/admin/auth/components/auth-motion"

type AdminAuthShellProps = {
  children: ReactNode
  title: string
  description: string
  badgeLabel?: string
}

export function AdminAuthShell({
  children,
  title,
  description,
  badgeLabel = "GESTÃO",
}: AdminAuthShellProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <MotionConfig reducedMotion="user">
      <motion.main
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={authStaggerVariants}
        className="min-h-svh bg-muted/30 p-3 sm:p-6 lg:p-8"
      >
        <motion.div
          variants={authStaggerVariants}
          className="mx-auto grid min-h-[calc(100svh-1.5rem)] max-w-6xl overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm sm:min-h-[calc(100svh-3rem)] md:grid-cols-[minmax(0,1fr)_minmax(390px,0.9fr)] lg:min-h-[calc(100svh-4rem)]"
        >
          <motion.aside
            variants={authItemVariants}
            className="relative z-10 hidden overflow-hidden bg-secondary/20 p-8 text-white md:flex md:flex-col md:justify-between lg:p-12 dark:bg-card/20"
          >
            <Image
              src="/images/auth/login-hero.png"
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1152px) 600px, (min-width: 768px) 50vw, 1px"
              className="pointer-events-none z-0 scale-[1.02] object-cover object-center blur-[1px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[1] opacity-40 backdrop-blur-[10px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[2] bg-black/20 dark:bg-black/30"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-black/60 via-black/10 to-transparent"
            />

            <motion.div
              variants={authStaggerVariants}
              className="relative z-10 flex h-full flex-col justify-between"
            >
              <motion.div
                variants={authItemVariants}
                className="flex items-start justify-between gap-4"
              >
                <Image
                  src="/brand/tavvi-lockup-horizontal-dark.png"
                  alt="Tavvi"
                  width={240}
                  height={94}
                  priority
                  className="h-auto w-36 object-contain"
                />
                <ThemeToggle className="border-white/30 bg-black/20 text-white hover:bg-black/35 hover:text-white" />
              </motion.div>
              <motion.h2
                variants={authItemVariants}
                className="max-w-sm text-2xl leading-tight font-medium tracking-tight lg:text-3xl"
              >
                Manage hub.
              </motion.h2>
            </motion.div>
          </motion.aside>

          <motion.section
            variants={authItemVariants}
            className="relative z-10 flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12"
          >
            <motion.div
              variants={authStaggerVariants}
              className="w-full max-w-md"
            >
              <motion.div
                variants={authItemVariants}
                className="mb-8 flex items-center justify-between gap-4 md:hidden"
              >
                <Image
                  src="/brand/tavvi-lockup-horizontal-light.png"
                  alt="Tavvi"
                  width={240}
                  height={94}
                  priority
                  className="h-auto w-28 object-contain dark:hidden sm:w-32"
                />
                <Image
                  src="/brand/tavvi-lockup-horizontal-dark.png"
                  alt="Tavvi"
                  width={240}
                  height={94}
                  priority
                  className="hidden h-auto w-28 object-contain dark:block sm:w-32"
                />
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[0.625rem] font-medium tracking-[0.14em] text-muted-foreground">
                    {badgeLabel}
                  </span>
                  <ThemeToggle />
                </div>
              </motion.div>

              <Card className="gap-0 border-0 bg-transparent py-0 shadow-none ring-0">
                <CardHeader className="gap-2 px-0 pb-6">
                  <motion.h1
                    variants={authItemVariants}
                    className="text-2xl font-semibold tracking-tight sm:text-3xl"
                  >
                    {title}
                  </motion.h1>
                  <motion.div variants={authItemVariants}>
                    <CardDescription className="max-w-sm text-sm leading-6">
                      {description}
                    </CardDescription>
                  </motion.div>
                </CardHeader>
                <CardContent className="px-0">
                  <motion.div variants={authItemVariants}>
                    {children}
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.section>
        </motion.div>
      </motion.main>
    </MotionConfig>
  )
}
