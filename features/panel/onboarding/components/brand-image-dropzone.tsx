"use client"

import { useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { LuCheck, LuImage, LuUpload, LuX } from "react-icons/lu"
import { Button } from "@/components/ui/button"
import { authItemVariants } from "@/features/admin/auth/components/auth-motion"

export function BrandImageDropzone({
  id,
  title,
  description,
  previewUrl,
  pendingFile,
  saved,
  saving,
  error,
  onSelect,
  onRemove,
}: {
  id: string
  title: string
  description: string
  previewUrl: string | null
  pendingFile: File | null
  saved: boolean
  saving: boolean
  error: string
  onSelect: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hasImage = Boolean(previewUrl)
  const sizeLabel = pendingFile
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(pendingFile.size / 1024 / 1024)} MB`
    : null

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) onSelect(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <motion.section variants={authItemVariants} className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors ${saved ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`} aria-hidden="true">
          {saved ? <LuCheck className="size-4" /> : <LuImage className="size-4" />}
        </span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={(event) => {
          const target = event.relatedTarget
          if (!(target instanceof Node) || !event.currentTarget.contains(target)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
        aria-describedby={`${id}-hint ${id}-status`}
        aria-label={`${title}: escolher arquivo ou arrastar uma imagem`}
        className={`group relative flex min-h-44 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed text-center outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring/40 ${dragging ? "scale-[1.01] border-primary bg-primary/[0.07] shadow-[0_0_0_4px] shadow-primary/10" : hasImage ? "border-border bg-muted/20 hover:border-primary/45" : "border-border/80 bg-muted/10 hover:border-primary/45 hover:bg-primary/[0.025]"}`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={`Prévia: ${title.toLowerCase()}`} className={`absolute inset-0 h-full w-full ${id.includes("logo") ? "object-contain p-6" : "object-cover"}`} />
        ) : (
          <span className={`mb-2 flex size-10 items-center justify-center rounded-2xl transition-colors ${dragging ? "bg-primary text-primary-foreground" : "bg-background text-primary shadow-sm"}`}>
            <LuUpload className="size-5" aria-hidden="true" />
          </span>
        )}
        {previewUrl ? <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-4 pb-3 pt-10 text-xs font-medium text-white">{pendingFile ? "Prévia pronta para salvar" : saved ? "Imagem salva" : "Prévia da imagem"}</span> : (
          <span className="px-5 text-sm font-medium">{dragging ? "Solte a imagem aqui" : "Arraste uma imagem ou escolha um arquivo"}</span>
        )}
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={`Arquivo de ${title.toLowerCase()}`}
        onChange={(event) => handleFiles(event.currentTarget.files)}
      />

      <div className="mt-3 flex min-h-9 items-center justify-between gap-2">
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">JPG, PNG ou WebP · até 5 MB</p>
        {hasImage ? <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-8 shrink-0 px-2.5 text-xs text-muted-foreground hover:text-destructive"><LuX data-icon="inline-start" aria-hidden="true" />Remover</Button> : null}
      </div>
      <div id={`${id}-status`} role="status" aria-live="polite" className="min-h-5 text-xs">
        <AnimatePresence mode="wait" initial={false}>
          {error ? <motion.p key="error" initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-destructive">{error}</motion.p>
            : saving ? <motion.p key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-primary">Salvando imagem…</motion.p>
              : pendingFile ? <motion.p key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground">{pendingFile.name} · {sizeLabel} · aguardando salvamento</motion.p>
                : saved ? <motion.p key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-primary">Pronta para o cardápio</motion.p>
                  : <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground">Campo opcional</motion.p>}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
