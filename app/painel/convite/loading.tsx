"use client"

import { motion, MotionConfig, useReducedMotion, type Variants } from "motion/react"

import { Skeleton } from "@/components/ui/skeleton"
import { ThemeToggle } from "@/components/theme-toggle"

const loadingSequence: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const loadingItem: Variants = {
  hidden: { opacity: 0, y: 7 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function InviteLoading() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <MotionConfig reducedMotion="user">
      <main aria-label="Validando convite" aria-busy="true" className="relative flex min-h-svh items-center justify-center bg-muted/35 px-4 py-10 motion-reduce:[&_[data-slot=skeleton]]:animate-none">
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <motion.div
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          variants={loadingSequence}
          className="w-full max-w-[560px]"
        >
          <motion.div variants={loadingItem} className="mb-6 flex justify-center">
            <Skeleton className="h-9 w-28 rounded-xl" />
          </motion.div>
          <motion.div variants={loadingItem} className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-foreground/[0.035]">
            <div className="space-y-4 border-b border-border/60 px-6 py-7 sm:px-9">
              <Skeleton className="size-11 rounded-2xl" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
            <div className="space-y-5 px-6 py-6 sm:px-9">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </motion.div>
        </motion.div>
      </main>
    </MotionConfig>
  )
}
