"use client"

import Link from "next/link"
import { motion, MotionConfig, useReducedMotion } from "motion/react"
import { LuArrowLeft, LuMailPlus, LuTicketCheck } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { authItemVariants, authStaggerVariants } from "@/features/admin/auth/components/auth-motion"

export function PanelContactCommercial({ loginHref }: { loginHref: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={authStaggerVariants}
        className="space-y-5"
      >
        <motion.div variants={authItemVariants} className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 text-center sm:p-6">
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, scale: 0.82, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
            className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          >
            <LuTicketCheck aria-hidden="true" className="size-7" />
          </motion.span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">Acesso por convite</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Para criar sua conta e começar, entre em contato com nosso time comercial e solicite um convite.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-primary">
            <LuMailPlus aria-hidden="true" className="size-4" />
            <span>Convites habilitam seu acesso ao Painel</span>
          </div>
        </motion.div>
        <motion.div variants={authItemVariants}>
          <Button nativeButton={false} render={<Link href={loginHref}><LuArrowLeft aria-hidden="true" />Voltar ao login</Link>} size="lg" variant="outline" className="h-11 w-full rounded-lg" />
        </motion.div>
      </motion.div>
    </MotionConfig>
  )
}
