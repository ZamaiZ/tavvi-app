"use client"

import { useState } from "react"
import { LuArrowUpRight, LuImage, LuMessageSquareText, LuVideo } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { FeedbackDTO } from "@/features/feedback/model"

function formatFeedbackDate(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function FeedbackCardMedia({ media }: { media: FeedbackDTO["media"][number] }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="relative grid size-[4.15rem] shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-muted/45">
      {media.kind === "image" && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="" className="size-full object-cover" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : media.kind === "video" ? (
        <><span className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" /><LuVideo aria-hidden="true" className="relative size-5 text-white/80" /><span className="absolute bottom-1 right-1 rounded bg-black/50 px-1 py-0.5 text-[0.55rem] font-semibold text-white">VÍDEO</span></>
      ) : <LuImage aria-hidden="true" className="size-4 text-muted-foreground" />}
    </span>
  )
}

export function FeedbackCard({ feedback, disabled = false, onOpen }: { feedback: FeedbackDTO; disabled?: boolean; onOpen: (feedback: FeedbackDTO) => void }) {
  const unread = !feedback.readAt
  return (
    <Card className={`group gap-0 overflow-hidden rounded-2xl border-border/70 bg-card/85 py-0 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-foreground/[0.04] motion-reduce:transform-none motion-reduce:transition-none ${unread ? "border-l-[3px] border-l-primary" : ""}`}>
      <button type="button" onClick={() => onOpen(feedback)} disabled={disabled} aria-label={`Abrir feedback recebido ${formatFeedbackDate(feedback.publishedAt)}${unread ? ", não lido" : ""}`} className="block w-full p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${unread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><LuMessageSquareText aria-hidden="true" className="size-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold tracking-tight">Feedback anônimo</p>
              <p className="mt-0.5 text-[0.68rem] text-muted-foreground">{formatFeedbackDate(feedback.publishedAt)}</p>
            </div>
          </div>
          {unread ? <Badge className="h-6 shrink-0 gap-1.5 rounded-full border border-primary/15 bg-primary/10 px-2.5 text-[0.63rem] font-semibold text-primary hover:bg-primary/10"><span className="size-1.5 rounded-full bg-primary" />Novo</Badge> : <Badge variant="secondary" className="h-6 shrink-0 rounded-full px-2.5 text-[0.63rem]">Lido</Badge>}
        </div>
        <p className="mt-4 line-clamp-3 min-h-[3.9rem] whitespace-pre-line break-words text-sm leading-6 text-foreground/85">{feedback.body}</p>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/60 pt-3.5">
          <div className="flex min-w-0 items-center gap-2">
            {feedback.media.length ? <div className="flex -space-x-2">{feedback.media.slice(0, 3).map((media) => <FeedbackCardMedia key={media.id} media={media} />)}</div> : <span className="inline-flex items-center gap-1.5 text-[0.68rem] text-muted-foreground"><LuMessageSquareText aria-hidden="true" className="size-3.5" />Somente texto</span>}
            {feedback.media.length ? <span className="text-[0.68rem] text-muted-foreground">{feedback.media.length} {feedback.media.length === 1 ? "mídia" : "mídias"}</span> : null}
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,color,transform] group-hover:translate-x-0.5 group-hover:bg-primary/10 group-hover:text-primary motion-reduce:transform-none"><LuArrowUpRight aria-hidden="true" className="size-4" /></span>
        </div>
      </button>
    </Card>
  )
}
