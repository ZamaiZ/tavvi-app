"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import type { CSSProperties } from "react"
import { LuCheck, LuImagePlus, LuLoaderCircle, LuPlay, LuShieldCheck, LuTrash2, LuVideo } from "react-icons/lu"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { publishFeedbackAction, startFeedbackAction } from "@/features/feedback/actions"
import {
  FEEDBACK_MAX_BODY_LENGTH,
  FEEDBACK_MAX_MEDIA,
  FEEDBACK_MEDIA_LIMITS,
  type FeedbackActionFailureCode,
} from "@/features/feedback/model"
import {
  feedbackMediaErrorMessage,
  prepareFeedbackMedia,
  prepareFeedbackUpload,
  type SelectedFeedbackMedia,
} from "@/features/feedback/lib/public-media"
import { uploadToSignedUrl } from "@/features/feedback/lib/upload-to-signed-url"
import type { PublicThemeStyle } from "@/features/public-profile/theme"
import { PUBLIC_THEME_FONT_VARIABLES } from "@/features/public-profile/fonts"
import styles from "@/features/feedback/styles/public-feedback.module.css"

type PublicFeedbackFormProps = {
  slug: string
  restaurantName: string
  themeStyle: PublicThemeStyle
  trigger: (open: () => void) => ReactNode
}

function failureMessage(code: FeedbackActionFailureCode) {
  switch (code) {
    case "invalid_input": return "Confira o texto e os arquivos antes de enviar."
    case "rate_limited": return "Recebemos muitas tentativas. Aguarde alguns minutos e tente novamente."
    case "media_missing": return "Uma mídia não chegou por completo. Confira sua conexão e tente enviar novamente."
    case "draft_expired": return "A preparação expirou. Tente novamente para enviar seu feedback."
    case "context_changed": return "Este restaurante não está recebendo feedbacks no momento."
    case "not_found": return "Não localizamos esta tentativa. Faça o envio novamente."
    default: return "Não foi possível concluir o envio agora. Confira sua conexão e tente novamente."
  }
}

export function PublicFeedbackForm({ slug, restaurantName, themeStyle, trigger }: PublicFeedbackFormProps) {
  const [open, setOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [body, setBody] = useState("")
  const [website, setWebsite] = useState("")
  const [media, setMedia] = useState<SelectedFeedbackMedia[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [progressLabel, setProgressLabel] = useState("")
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<SelectedFeedbackMedia[]>([])
  const themeStyleValue = themeStyle as CSSProperties

  useEffect(() => { mediaRef.current = media }, [media])
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)")
    const updateViewport = (event: MediaQueryList | MediaQueryListEvent) => setIsMobile(event.matches)
    updateViewport(mediaQuery)
    mediaQuery.addEventListener("change", updateViewport)
    return () => mediaQuery.removeEventListener("change", updateViewport)
  }, [])
  useEffect(() => () => {
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  }, [])

  function clearMedia(items = mediaRef.current) {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    mediaRef.current = []
    setMedia([])
  }

  function resetForm() {
    clearMedia()
    setBody("")
    setWebsite("")
    setPreparing(false)
    setSending(false)
    setSuccess(false)
    setProgressLabel("")
    setMediaError(null)
    setSubmitError(null)
  }

  function requestClose() {
    if (preparing || sending) return
    if (success) {
      resetForm()
      setOpen(false)
      return
    }
    if (body.trim() || media.length) {
      setDiscardOpen(true)
      return
    }
    resetForm()
    setOpen(false)
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const incoming = Array.from(files)
    const available = Math.max(0, FEEDBACK_MAX_MEDIA - media.length)
    setMediaError(incoming.length > available ? "O limite é de três imagens e vídeos por feedback." : null)
    if (available === 0) return
    setPreparing(true)
    setSubmitError(null)
    const selected: SelectedFeedbackMedia[] = []
    for (const file of incoming.slice(0, available)) {
      try {
        selected.push(await prepareFeedbackMedia(file))
      } catch (cause) {
        setMediaError(feedbackMediaErrorMessage(cause))
      }
    }
    if (selected.length) setMedia((current) => [...current, ...selected].slice(0, FEEDBACK_MAX_MEDIA))
    setPreparing(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  function removeMedia(key: string) {
    const selected = media.find((item) => item.key === key)
    if (selected) URL.revokeObjectURL(selected.previewUrl)
    setMedia((current) => current.filter((item) => item.key !== key))
    setMediaError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanBody = body.trim()
    if (cleanBody.length < 3 || cleanBody.length > FEEDBACK_MAX_BODY_LENGTH || preparing || sending) return

    setSending(true)
    setSubmitError(null)
    setProgressLabel("Preparando seu feedback…")
    try {
      const prepared = await Promise.all(media.map(prepareFeedbackUpload))
      const startResult = await startFeedbackAction({
        slug,
        body: cleanBody,
        media: prepared.map((item) => item.input),
        website,
      })
      if (!startResult.ok) {
        setSubmitError(failureMessage(startResult.code))
        return
      }
      if (startResult.data.ignored) {
        clearMedia()
        setBody("")
        setSuccess(true)
        return
      }

      let uploadedCount = 0
      const uploadResults = await Promise.allSettled(startResult.data.uploads.map(async (ticket) => {
        const upload = prepared[ticket.position]
        if (!upload) throw new Error("feedback_upload_ticket_invalid")
        await uploadToSignedUrl(ticket.signedUrl, upload.blob, upload.input.mime)
        uploadedCount += 1
        setProgressLabel(`Enviando mídias (${uploadedCount} de ${startResult.data.uploads.length})…`)
      }))
      const failedUpload = uploadResults.find((result) => result.status === "rejected")
      if (failedUpload?.status === "rejected") throw failedUpload.reason

      setProgressLabel("Finalizando o envio…")
      const publishResult = await publishFeedbackAction({ feedbackId: startResult.data.feedbackId })
      if (!publishResult.ok) {
        setSubmitError(failureMessage(publishResult.code))
        return
      }

      clearMedia()
      setBody("")
      setSuccess(true)
    } catch {
      setSubmitError("O envio foi interrompido. Seu texto e seus arquivos continuam aqui para tentar novamente.")
    } finally {
      setSending(false)
      setProgressLabel("")
    }
  }

  const canSubmit = body.trim().length >= 3 && body.trim().length <= FEEDBACK_MAX_BODY_LENGTH && !preparing && !sending
  const accept = [...FEEDBACK_MEDIA_LIMITS.image.mimes, ...FEEDBACK_MEDIA_LIMITS.video.mimes].join(",")

  return (
    <>
      {trigger(() => { resetForm(); setOpen(true) })}
      <Sheet open={open} onOpenChange={(next) => { if (next) setOpen(true); else requestClose() }}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          showCloseButton={!sending && !preparing}
          className={`${styles.sheet} ${PUBLIC_THEME_FONT_VARIABLES}`}
          style={themeStyleValue}
          aria-describedby="feedback-sheet-description"
        >
          <SheetHeader>
            <SheetTitle>{success ? "Obrigado por compartilhar" : "Conte como foi sua experiência"}</SheetTitle>
            <SheetDescription id="feedback-sheet-description">
              {success ? `Seu feedback foi enviado para ${restaurantName}.` : `Seu relato será recebido pela equipe de ${restaurantName}.`}
            </SheetDescription>
          </SheetHeader>

          {success ? (
            <div className={styles.success}>
              <span className={styles.successIcon} aria-hidden="true"><LuCheck /></span>
              <h3>Recebemos seu feedback</h3>
              <p>Obrigado por ajudar {restaurantName} a tornar a experiência ainda melhor.</p>
              <Button type="button" className={styles.submitButton} onClick={requestClose}>Voltar ao cardápio</Button>
            </div>
          ) : (
            <form className={styles.body} onSubmit={submit}>
              <div className={styles.intro} style={{ "--feedback-enter-index": 0 } as CSSProperties}>
                <LuShieldCheck aria-hidden="true" />
                <span><strong>Seu feedback é anônimo.</strong> Não pedimos nome nem contato. Compartilhe o que achou, com sinceridade.</span>
              </div>

              <div className={styles.reveal} style={{ "--feedback-enter-index": 1 } as CSSProperties}>
                <label htmlFor="public-feedback-body" className={styles.fieldLabel}>
                  <span>Seu comentário</span>
                  <span className={styles.counter}>{body.length}/{FEEDBACK_MAX_BODY_LENGTH}</span>
                </label>
                <Textarea
                  id="public-feedback-body"
                  className={styles.textarea}
                  placeholder="O que você mais gostou? O que poderia ficar melhor?"
                  value={body}
                  maxLength={FEEDBACK_MAX_BODY_LENGTH}
                  onChange={(event) => { setBody(event.target.value); setSubmitError(null) }}
                  disabled={sending || preparing}
                  aria-describedby="public-feedback-body-help"
                  required
                />
                <p id="public-feedback-body-help" className={styles.uploadHelp}>Escreva pelo menos três caracteres. Compartilhe apenas o que quiser.</p>
              </div>

              <div className={styles.reveal} style={{ "--feedback-enter-index": 2 } as CSSProperties}>
                <div className={styles.uploadLabel}>
                  <span>Fotos e vídeos</span>
                  <span className={styles.uploadHelp}>{media.length}/{FEEDBACK_MAX_MEDIA}</span>
                </div>
                <input
                  ref={inputRef}
                  className={styles.fileInput}
                  type="file"
                  accept={accept}
                  multiple
                  tabIndex={-1}
                  aria-label="Adicionar imagens ou vídeos"
                  disabled={preparing || sending || media.length >= FEEDBACK_MAX_MEDIA}
                  onChange={(event) => { void addFiles(event.currentTarget.files) }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className={styles.uploadButton}
                  onClick={() => inputRef.current?.click()}
                  disabled={preparing || sending || media.length >= FEEDBACK_MAX_MEDIA}
                >
                  {preparing ? <LuLoaderCircle aria-hidden="true" /> : <LuImagePlus aria-hidden="true" />}
                  {preparing ? "Preparando arquivo…" : media.length >= FEEDBACK_MAX_MEDIA ? "Limite de arquivos atingido" : "Adicionar imagens ou vídeos"}
                </Button>
                {media.length ? (
                  <div className={styles.mediaGrid} aria-label="Mídias selecionadas">
                    {media.map((item) => (
                      <div key={item.key} className={styles.mediaCard}>
                        {item.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewUrl} alt="Prévia da imagem selecionada" className={styles.mediaPreview} />
                        ) : (
                          <video src={item.previewUrl} className={styles.mediaPreview} preload="metadata" muted playsInline />
                        )}
                        {item.kind === "video" ? <><span className={styles.videoPlayMark}><LuPlay aria-hidden="true" /></span><span className={styles.videoMark}><LuVideo aria-hidden="true" /> Vídeo</span></> : null}
                        <button
                          type="button"
                          className={styles.removeMedia}
                          aria-label="Remover mídia selecionada"
                          disabled={sending || preparing}
                          onClick={() => removeMedia(item.key)}
                        >
                          <LuTrash2 aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className={styles.uploadHelp}>Até três arquivos. Fotos: 5 MiB após preparação. Vídeos MP4/WebM: até 10 MiB e 15 segundos.</p>
                {mediaError ? <p className={styles.error} role="alert">{mediaError}</p> : null}
              </div>

              <label className={styles.honeypot} aria-hidden="true">
                Website
                <input autoComplete="off" tabIndex={-1} value={website} onChange={(event) => setWebsite(event.target.value)} />
              </label>
              {progressLabel ? <p className={styles.progress} role="status"><LuLoaderCircle aria-hidden="true" />{progressLabel}</p> : null}
              {submitError ? <p className={styles.error} role="alert">{submitError}</p> : null}
            </form>
          )}

          {!success ? (
            <div className={styles.footer}>
              <Button type="button" className={styles.submitButton} onClick={() => inputRef.current?.form?.requestSubmit()} disabled={!canSubmit}>
                {sending ? <><LuLoaderCircle aria-hidden="true" /> Enviando…</> : "Enviar feedback"}
              </Button>
              <p className={styles.footerNote}>Seu relato só será visto pela equipe deste restaurante.</p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar seu feedback?</AlertDialogTitle>
            <AlertDialogDescription>O texto e as mídias selecionadas serão removidos deste formulário.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar escrevendo</AlertDialogCancel>
            <AlertDialogAction onClick={() => { resetForm(); setDiscardOpen(false); setOpen(false) }}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
