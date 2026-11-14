"use client"

import { useState } from "react"
import { LuChevronLeft, LuChevronRight, LuImageOff, LuPlay, LuVideo } from "react-icons/lu"

import type { FeedbackMediaDTO } from "@/features/feedback/model"

function MediaUnavailable() {
  return <div className="grid aspect-video w-full place-items-center rounded-2xl border border-dashed border-border bg-muted/30 text-muted-foreground"><span className="flex items-center gap-2 text-sm"><LuImageOff aria-hidden="true" className="size-4" />Mídia indisponível</span></div>
}

export function FeedbackMediaViewer({ media }: { media: FeedbackMediaDTO[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [retried, setRetried] = useState<string[]>([])
  const [failed, setFailed] = useState<string[]>([])
  if (!media.length) return null

  const active = media[Math.min(activeIndex, media.length - 1)]
  const source = retried.includes(active.id) ? `${active.url}?refresh=1` : active.url
  const isFailed = failed.includes(active.id)

  function retryOrFail(id: string) {
    if (!retried.includes(id)) setRetried((current) => [...current, id])
    else setFailed((current) => current.includes(id) ? current : [...current, id])
  }

  function step(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + media.length) % media.length)
  }

  return (
    <section aria-label="Mídias do feedback" className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-black/90">
        {isFailed ? <MediaUnavailable /> : active.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={source} alt={`Imagem ${activeIndex + 1} do feedback`} className="mx-auto max-h-[52svh] w-full object-contain" onError={() => retryOrFail(active.id)} />
        ) : (
          <video key={source} src={source} controls playsInline preload="metadata" className="max-h-[52svh] w-full" onError={() => retryOrFail(active.id)} aria-label={`Vídeo ${activeIndex + 1} do feedback`} />
        )}
        {media.length > 1 ? (
          <>
            <button type="button" aria-label="Mídia anterior" onClick={() => step(-1)} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg transition-colors hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white"><LuChevronLeft aria-hidden="true" className="size-5" /></button>
            <button type="button" aria-label="Próxima mídia" onClick={() => step(1)} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg transition-colors hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white"><LuChevronRight aria-hidden="true" className="size-5" /></button>
          </>
        ) : null}
        <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-[0.68rem] font-medium tabular-nums text-white">{activeIndex + 1} / {media.length}</span>
      </div>

      {media.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Escolher mídia">
          {media.map((item, index) => (
            <button key={item.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Abrir ${item.kind === "image" ? "imagem" : "vídeo"} ${index + 1}`} aria-pressed={index === activeIndex} className={`relative grid size-[4.25rem] shrink-0 place-items-center overflow-hidden rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-primary ${index === activeIndex ? "border-primary ring-2 ring-primary/20" : "border-border/70 bg-muted/40 hover:border-primary/45"}`}>
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="size-full object-cover" />
              ) : <><span className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" /><LuVideo aria-hidden="true" className="relative size-5 text-white/80" /><LuPlay aria-hidden="true" className="absolute bottom-1 right-1 size-3 text-white" /></>}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
