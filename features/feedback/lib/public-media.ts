import {
  FEEDBACK_MAX_VIDEO_DURATION_MS,
  FEEDBACK_MEDIA_LIMITS,
  type FeedbackMediaInput,
  type FeedbackMediaKind,
} from "../model"

export type SelectedFeedbackMedia = {
  key: string
  file: File
  kind: FeedbackMediaKind
  previewUrl: string
  width: number
  height: number
  durationMs: number | null
}

export type PreparedFeedbackUpload = {
  blob: Blob
  input: FeedbackMediaInput
}

const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024

function readVideoMetadata(previewUrl: string) {
  return new Promise<{ width: number; height: number; durationMs: number }>((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true
    const timeout = window.setTimeout(() => finish(new Error("metadata_timeout")), 8_000)

    function finish(error?: Error, metadata?: { width: number; height: number; durationMs: number }) {
      window.clearTimeout(timeout)
      video.onloadedmetadata = null
      video.onerror = null
      video.removeAttribute("src")
      video.load()
      if (error) reject(error)
      else if (metadata) resolve(metadata)
      else reject(new Error("metadata_invalid"))
    }

    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth <= 0 || video.videoHeight <= 0) {
        finish(new Error("metadata_invalid"))
      } else if (video.duration * 1000 > FEEDBACK_MAX_VIDEO_DURATION_MS) {
        finish(new Error("duration_limit"))
      } else {
        finish(undefined, {
          width: video.videoWidth,
          height: video.videoHeight,
          durationMs: Math.ceil(video.duration * 1000),
        })
      }
    }
    video.onerror = () => finish(new Error("metadata_invalid"))
    video.src = previewUrl
  })
}

export async function prepareFeedbackMedia(file: File): Promise<SelectedFeedbackMedia> {
  const kind: FeedbackMediaKind | null = (FEEDBACK_MEDIA_LIMITS.image.mimes as readonly string[]).includes(file.type)
    ? "image"
    : (FEEDBACK_MEDIA_LIMITS.video.mimes as readonly string[]).includes(file.type)
      ? "video"
      : null
  if (!kind) throw new Error("format")

  const sourceLimit = kind === "image" ? MAX_SOURCE_IMAGE_BYTES : FEEDBACK_MEDIA_LIMITS.video.maxBytes
  if (file.size <= 0 || file.size > sourceLimit) {
    throw new Error(kind === "image" ? "image_source_size" : "video_size")
  }

  const previewUrl = URL.createObjectURL(file)
  try {
    if (kind === "image") {
      const bitmap = await createImageBitmap(file)
      try {
        return {
          key: crypto.randomUUID(),
          file,
          kind,
          previewUrl,
          width: bitmap.width,
          height: bitmap.height,
          durationMs: null,
        }
      } finally {
        bitmap.close()
      }
    }

    const metadata = await readVideoMetadata(previewUrl)
    return { key: crypto.randomUUID(), file, kind, previewUrl, ...metadata }
  } catch (cause) {
    URL.revokeObjectURL(previewUrl)
    if (cause instanceof Error && cause.message === "duration_limit") throw cause
    throw new Error("metadata")
  }
}

async function canvasToWebp(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("image_encode")), "image/webp", 0.86)
  })
}

async function prepareImageUpload(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("image_encode")
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await canvasToWebp(canvas)
    if (!(FEEDBACK_MEDIA_LIMITS.image.mimes as readonly string[]).includes(blob.type) || blob.size > FEEDBACK_MEDIA_LIMITS.image.maxBytes) {
      throw new Error("image_limit")
    }
    return { blob, width, height }
  } finally {
    bitmap.close()
  }
}

export async function prepareFeedbackUpload(media: SelectedFeedbackMedia): Promise<PreparedFeedbackUpload> {
  if (media.kind === "image") {
    const prepared = await prepareImageUpload(media.file)
    return {
      blob: prepared.blob,
      input: {
        kind: media.kind,
        mime: prepared.blob.type,
        byteSize: prepared.blob.size,
        width: prepared.width,
        height: prepared.height,
        durationMs: null,
      },
    }
  }

  if (media.durationMs === null || media.durationMs > FEEDBACK_MAX_VIDEO_DURATION_MS) throw new Error("duration_limit")
  if (media.file.size > FEEDBACK_MEDIA_LIMITS.video.maxBytes) throw new Error("video_size")
  return {
    blob: media.file,
    input: {
      kind: media.kind,
      mime: media.file.type,
      byteSize: media.file.size,
      width: media.width,
      height: media.height,
      durationMs: media.durationMs,
    },
  }
}

export function feedbackMediaErrorMessage(cause: unknown) {
  if (!(cause instanceof Error)) return "Não foi possível preparar este arquivo. Tente outro."
  if (cause.message === "format") return "Use uma foto JPEG, PNG, WebP ou AVIF, ou um vídeo MP4 ou WebM."
  if (cause.message === "image_source_size") return "A foto original deve ter até 20 MiB para ser preparada."
  if (cause.message === "video_size") return "O vídeo deve ter até 10 MiB."
  if (cause.message === "duration_limit") return "Cada vídeo deve ter até 15 segundos."
  if (cause.message === "image_limit") return "A foto preparada ultrapassou 5 MiB. Escolha outra imagem."
  if (cause.message === "metadata") return "Não foi possível ler esse arquivo. Tente um vídeo compatível ou outra foto."
  return "Não foi possível preparar este arquivo. Tente outro."
}
