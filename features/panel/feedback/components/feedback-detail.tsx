"use client"

import { useState } from "react"
import { LuCheck, LuCircleAlert, LuLoaderCircle, LuMailOpen, LuTrash2 } from "react-icons/lu"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { FeedbackDTO } from "@/features/feedback/model"
import { FeedbackMediaViewer } from "./feedback-media-viewer"

function formatFeedbackDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date(value))
}

function DetailBody({
  feedback,
  busy,
  error,
  onToggleRead,
  onDelete,
}: {
  feedback: FeedbackDTO
  busy: boolean
  error: string | null
  onToggleRead: () => void
  onDelete: () => void
}) {
  const unread = !feedback.readAt
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{formatFeedbackDate(feedback.publishedAt)}</span>
        <span className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${unread ? "bg-primary" : "bg-muted-foreground/50"}`} />{unread ? "Não lido" : "Lido"}</span>
      </div>

      <p className="mb-5 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">{feedback.body}</p>

      {feedback.media.length ? <FeedbackMediaViewer key={feedback.id} media={feedback.media} /> : <div className="mb-5 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">Este feedback não tem imagens ou vídeos.</div>}

      {error ? <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.045] px-3.5 py-3 text-xs leading-5 text-destructive"><LuCircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border/70 pt-4">
        <Button type="button" variant="outline" className="min-h-10 flex-1 rounded-xl sm:flex-none" disabled={busy} onClick={onToggleRead}>
          {busy ? <LuLoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : unread ? <LuCheck aria-hidden="true" /> : <LuMailOpen aria-hidden="true" />}
          {unread ? "Marcar como lido" : "Marcar como não lido"}
        </Button>
        <Button type="button" variant="ghost" className="min-h-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy} onClick={onDelete}><LuTrash2 aria-hidden="true" />Excluir</Button>
      </div>
    </div>
  )
}

export function FeedbackDetail({
  feedback,
  open,
  isMobile,
  busy,
  error,
  onOpenChange,
  onToggleRead,
  onDelete,
}: {
  feedback: FeedbackDTO | null
  open: boolean
  isMobile: boolean
  busy: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onToggleRead: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!feedback) return null

  const content = (
    <DetailBody
      feedback={feedback}
      busy={busy}
      error={error}
      onToggleRead={onToggleRead}
      onDelete={() => setConfirmDelete(true)}
    />
  )

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="max-h-[92dvh] w-full gap-0 overflow-hidden rounded-t-[1.65rem] border-border/70 bg-background p-0 sm:max-w-none">
            <SheetHeader className="border-b border-border/70 px-5 pt-6 pb-4 pr-14 text-left sm:px-6">
              <SheetTitle className="text-base font-semibold tracking-tight">Feedback anônimo</SheetTitle>
              <SheetDescription>{feedback.media.length ? `${feedback.media.length} ${feedback.media.length === 1 ? "mídia anexada" : "mídias anexadas"}` : "Relato recebido pelo cardápio público"}</SheetDescription>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="flex max-h-[90svh] flex-col overflow-hidden p-0 sm:max-w-3xl">
            <DialogHeader className="border-b border-border/70 px-6 pt-6 pb-4 pr-14 text-left">
              <DialogTitle className="text-base font-semibold tracking-tight">Feedback anônimo</DialogTitle>
              <DialogDescription>{feedback.media.length ? `${feedback.media.length} ${feedback.media.length === 1 ? "mídia anexada" : "mídias anexadas"}` : "Relato recebido pelo cardápio público"}</DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este feedback?</AlertDialogTitle>
            <AlertDialogDescription>O relato sairá da caixa e as mídias privadas serão excluídas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Manter feedback</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => { setConfirmDelete(false); onDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/85"><LuTrash2 aria-hidden="true" />Excluir feedback</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
