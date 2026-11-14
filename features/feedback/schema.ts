import { z } from "zod"

import {
  FEEDBACK_MAX_BODY_LENGTH,
  FEEDBACK_MAX_MEDIA,
  FEEDBACK_MAX_VIDEO_DURATION_MS,
  FEEDBACK_MEDIA_LIMITS,
  FEEDBACK_MIN_BODY_LENGTH,
} from "./model"

const uuidSchema = z.string().uuid()

export const feedbackMediaInputSchema = z.object({
  kind: z.enum(["image", "video"]),
  mime: z.string().trim().min(1).max(80),
  byteSize: z.number().int().positive().max(FEEDBACK_MEDIA_LIMITS.video.maxBytes),
  width: z.number().int().min(1).max(10_000),
  height: z.number().int().min(1).max(10_000),
  durationMs: z.number().int().min(1).max(FEEDBACK_MAX_VIDEO_DURATION_MS).nullable(),
}).strict().superRefine((media, context) => {
  const limits = FEEDBACK_MEDIA_LIMITS[media.kind]
  if (!(limits.mimes as readonly string[]).includes(media.mime)) {
    context.addIssue({ code: "custom", path: ["mime"], message: "Formato de mídia não aceito." })
  }
  if (media.byteSize > limits.maxBytes) {
    context.addIssue({ code: "custom", path: ["byteSize"], message: "Arquivo acima do limite permitido." })
  }

  if (media.kind === "image") {
    if (media.width > 1920 || media.height > 1920) {
      context.addIssue({ code: "custom", path: ["width"], message: "Imagem acima da resolução permitida." })
    }
    if (media.durationMs !== null) {
      context.addIssue({ code: "custom", path: ["durationMs"], message: "Imagem não pode ter duração." })
    }
  } else if (media.durationMs === null) {
    context.addIssue({ code: "custom", path: ["durationMs"], message: "Informe a duração do vídeo." })
  }
})

export const startFeedbackSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body: z.string().trim().min(FEEDBACK_MIN_BODY_LENGTH).max(FEEDBACK_MAX_BODY_LENGTH),
  media: z.array(feedbackMediaInputSchema).max(FEEDBACK_MAX_MEDIA),
  website: z.string().max(200).optional(),
}).strict()

export type StartFeedbackInput = z.infer<typeof startFeedbackSchema>

export const publishFeedbackSchema = z.object({
  feedbackId: uuidSchema,
}).strict()
