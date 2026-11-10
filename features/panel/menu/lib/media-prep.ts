"use client"

import { MENU_MAX_VIDEO_DURATION_MS, MENU_MEDIA_LIMITS, type MenuMediaKind, type MenuUploadTicket } from "../model"
import { createMenuUploadTicketAction, discardMenuUploadsAction } from "../actions"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { compressMenuImage, compressMenuVideo } from "./media-compression"

export type SelectedMenuMedia = {
  key: string
  file: File
  kind: MenuMediaKind
  durationMs: number | null
  poster: Blob | null
  previewUrl: string
}

export type SavedMenuMediaInput = {
  id: string
  kind: MenuMediaKind
  storagePath: string
  posterPath: string | null
  altText: string
  width: number | null
  height: number | null
  durationMs: number | null
  position: number
}

export type UploadedMenuMedia = SavedMenuMediaInput & {
  url: string
  posterUrl: string | null
  cleanup: { bucket: MenuUploadTicket["bucket"]; path: string }[]
}

const ACCEPTED_MIMES = new Set<string>([
  ...MENU_MEDIA_LIMITS.image.mimes,
  ...MENU_MEDIA_LIMITS.video.mimes,
])

function waitForMedia(element: HTMLMediaElement, eventName: string, timeoutMs = 10_000) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error("A leitura da mídia expirou."))
    }, timeoutMs)
    const cleanup = () => {
      window.clearTimeout(timeout)
      element.removeEventListener(eventName, onSuccess)
      element.removeEventListener("error", onError)
    }
    const onSuccess = () => { cleanup(); resolve() }
    const onError = () => { cleanup(); reject(new Error("Mídia não legível.")) }
    element.addEventListener(eventName, onSuccess, { once: true })
    element.addEventListener("error", onError, { once: true })
  })
}

async function inspectVideo(file: File): Promise<{ durationMs: number | null; poster: Blob | null }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")
  video.preload = "metadata"
  video.muted = true
  video.playsInline = true
  let durationMs: number | null = null
  let poster: Blob | null = null
  try {
    const metadataLoaded = waitForMedia(video, "loadedmetadata")
    video.src = url
    await metadataLoaded
    durationMs = Number.isFinite(video.duration) && video.duration > 0 ? Math.max(1, Math.round(video.duration * 1000)) : null
    if (video.videoWidth && video.videoHeight) {
      const seeked = waitForMedia(video, "seeked")
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2)
      await seeked
      const canvas = document.createElement("canvas")
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      const context = canvas.getContext("2d")
      if (context) {
        context.drawImage(video, 0, 0)
        poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85))
      }
    }
  } catch {
    poster = null
  } finally {
    video.removeAttribute("src")
    video.load()
    URL.revokeObjectURL(url)
  }
  if (durationMs === null) {
    try {
      const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny")
      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
      const duration = await input.computeDuration()
      if (Number.isFinite(duration) && duration > 0) durationMs = Math.max(1, Math.round(duration * 1000))
    } catch {
      durationMs = null
    }
  }
  return { durationMs, poster }
}

export async function inspectMenuFile(file: File): Promise<SelectedMenuMedia> {
  if (!ACCEPTED_MIMES.has(file.type)) throw new Error(`“${file.name}” não está em um formato de foto ou vídeo aceito.`)
  const kind: MenuMediaKind = file.type.startsWith("image/") ? "image" : "video"
  const inspected = kind === "video" ? await inspectVideo(file) : { durationMs: null, poster: null }
  if (kind === "video" && inspected.durationMs === null) {
    throw new Error(`Não foi possível ler a duração de “${file.name}”. Envie um MP4 ou WebM de até 15 segundos.`)
  }
  if (inspected.durationMs !== null && inspected.durationMs > MENU_MAX_VIDEO_DURATION_MS) {
    throw new Error(`“${file.name}” ultrapassa o limite de 15 segundos.`)
  }
  return {
    key: crypto.randomUUID(),
    file,
    kind,
    durationMs: inspected.durationMs,
    poster: inspected.poster,
    previewUrl: URL.createObjectURL(inspected.poster ?? file),
  }
}

async function issueTicket(expectedRestaurantId: string, itemId: string, kind: MenuMediaKind, blob: Blob) {
  if (blob.size > MENU_MEDIA_LIMITS[kind].maxBytes) {
    throw new Error(`O arquivo preparado ultrapassa o limite de ${kind === "image" ? "5 MiB" : "10 MiB"}.`)
  }
  const mimeType = blob.type
  const response = await createMenuUploadTicketAction({ expectedRestaurantId, itemId, kind, mimeType, byteSize: blob.size })
  if (!response.ok) throw new Error(response.code === "storage_unavailable" ? "O armazenamento está indisponível. Tente novamente." : "Não foi possível preparar o envio.")
  return response.data
}

async function uploadTicket(ticket: MenuUploadTicket, blob: Blob) {
  const { error } = await createSupabaseBrowserClient("panel")
    .storage.from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType: blob.type, upsert: false })
  if (error) throw new Error("Não foi possível enviar a mídia. Confira a conexão e tente novamente.")
}

export async function uploadMenuMedia({
  expectedRestaurantId,
  itemId,
  selected,
  onProgress,
}: {
  expectedRestaurantId: string
  itemId: string
  selected: SelectedMenuMedia
  onProgress: (progress: number) => void
}): Promise<UploadedMenuMedia> {
  let blob: Blob = selected.file
  let width: number | null = null
  let height: number | null = null
  let durationMs = selected.durationMs
  if (selected.kind === "image") {
    const compressed = await compressMenuImage(selected.file)
    blob = compressed.blob
    width = compressed.width
    height = compressed.height
  } else {
    const compressed = await compressMenuVideo(selected.file, onProgress)
    if (compressed) {
      blob = compressed.blob
      width = compressed.width
      height = compressed.height
    }
    if (durationMs === null || durationMs > MENU_MAX_VIDEO_DURATION_MS) throw new Error("O vídeo precisa ter até 15 segundos.")
  }

  const uploaded: { bucket: MenuUploadTicket["bucket"]; path: string }[] = []
  let mainTicket: MenuUploadTicket | null = null
  let posterPath: string | null = null
  try {
    mainTicket = await issueTicket(expectedRestaurantId, itemId, selected.kind, blob)
    uploaded.push({ bucket: mainTicket.bucket, path: mainTicket.path })
    await uploadTicket(mainTicket, blob)
    onProgress(100)

    if (selected.kind === "video" && selected.poster && (MENU_MEDIA_LIMITS.image.mimes as readonly string[]).includes(selected.poster.type)) {
      let optionalPosterPath: (typeof uploaded)[number] | null = null
      try {
        const posterTicket = await issueTicket(expectedRestaurantId, itemId, "image", selected.poster)
        optionalPosterPath = { bucket: posterTicket.bucket, path: posterTicket.path }
        uploaded.push(optionalPosterPath)
        await uploadTicket(posterTicket, selected.poster)
        posterPath = posterTicket.path
      } catch {
        if (optionalPosterPath) {
          await discardMenuUploadsAction({ expectedRestaurantId, files: [optionalPosterPath] })
          const index = uploaded.indexOf(optionalPosterPath)
          if (index >= 0) uploaded.splice(index, 1)
        }
        // Poster opcional: vídeo segue válido sem capa.
      }
    }
  } catch (cause) {
    if (uploaded.length) {
      await discardMenuUploadsAction({ expectedRestaurantId, files: uploaded })
    }
    throw cause
  }
  if (!mainTicket) throw new Error("Não foi possível preparar o envio.")
  return {
    id: mainTicket.id,
    kind: selected.kind,
    storagePath: mainTicket.path,
    posterPath,
    altText: "",
    width,
    height,
    durationMs,
    position: 0,
    url: selected.previewUrl,
    posterUrl: posterPath ? selected.previewUrl : null,
    cleanup: uploaded,
  }
}

export async function discardUploadedMenuMedia(expectedRestaurantId: string, media: UploadedMenuMedia[]) {
  const files = media.flatMap((entry) => entry.cleanup)
  if (files.length) await discardMenuUploadsAction({ expectedRestaurantId, files })
}
