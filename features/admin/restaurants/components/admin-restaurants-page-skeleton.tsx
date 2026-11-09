"use client"

import {
  motion,
  MotionConfig,
  useReducedMotion,
  type Variants,
} from "motion/react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const sequence: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.075, delayChildren: 0.04 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
}

export function AdminRestaurantsPageSkeleton() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        aria-label="Carregando restaurantes"
        aria-busy="true"
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={sequence}
        className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-8 motion-reduce:[&_[data-slot=skeleton]]:animate-none"
      >
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 sm:gap-6">
          <motion.div
            variants={item}
            className="flex items-center justify-between gap-4"
          >
            <div className="space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72 max-w-[70vw]" />
            </div>
          </motion.div>

          <motion.div variants={sequence} className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <motion.div key={index} variants={item}>
                <Card className="gap-0 rounded-2xl border-border/70 py-0 shadow-sm">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Skeleton className="size-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={item}>
            <Card className="gap-0 overflow-hidden rounded-2xl border-border/70 bg-card py-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-64 max-w-[60vw]" />
                </div>
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent className="space-y-4 px-4 py-4 sm:px-5">
                <Skeleton className="h-9 w-full max-w-md rounded-xl" />
                <div className="flex gap-1 overflow-hidden">
                  {["w-16", "w-24", "w-20", "w-24"].map((width, index) => (
                    <Skeleton
                      key={index}
                      className={`h-8 shrink-0 rounded-lg ${width}`}
                    />
                  ))}
                </div>
                <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                  <Skeleton className="h-11 rounded-none" />
                  {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton
                      key={index}
                      className="h-[4.5rem] rounded-none border-t border-background"
                    />
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:hidden">
                  {Array.from({ length: 4 }, (_, index) => (
                    <motion.div key={index} variants={item}>
                      <div className="relative flex min-h-[124px] flex-col rounded-2xl border border-border/70 bg-background p-4">
                        <Skeleton className="absolute top-2 right-2 size-8 rounded-lg" />
                        <div className="flex min-w-0 items-start gap-3">
                          <Skeleton className="size-10 shrink-0 rounded-xl" />
                          <div className="min-w-0 flex-1 space-y-2 pr-10">
                            <Skeleton className="h-4 w-28 max-w-full" />
                            <Skeleton className="h-3 w-24 max-w-full" />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </MotionConfig>
  )
}
