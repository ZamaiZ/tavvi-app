export type FeedbackMediaKind = "image" | "video"

export type FeedbackMediaInput = {
  kind: FeedbackMediaKind
  mime: string
  byteSize: number
  width: number
  height: number
  durationMs: number | null
}

export type FeedbackUploadTicket = {
  position: number
  bucket: "feedback-images" | "feedback-videos"
  signedUrl: string
}

export type StartedFeedback = {
  feedbackId: string
  uploads: FeedbackUploadTicket[]
  /** True for a honeypot submission that should look successful to its sender. */
  ignored?: boolean
}

export type FeedbackMediaDTO = {
  id: string
  kind: FeedbackMediaKind
  url: string
  width: number
  height: number
  durationMs: number | null
  position: number
}

export type FeedbackDTO = {
  id: string
  body: string
  publishedAt: string
  readAt: string | null
  media: FeedbackMediaDTO[]
}

export type FeedbackFilter = "all" | "unread"
export type FeedbackCursor = { publishedAt: string; id: string }
export type FeedbackPage = { items: FeedbackDTO[]; nextCursor: FeedbackCursor | null }

export type FeedbackActionFailureCode =
  | "invalid_input"
  | "rate_limited"
  | "media_missing"
  | "draft_expired"
  | "context_changed"
  | "not_found"
  | "unavailable"

export type FeedbackActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: FeedbackActionFailureCode }

export const FEEDBACK_MAX_MEDIA = 3
export const FEEDBACK_MIN_BODY_LENGTH = 3
export const FEEDBACK_MAX_BODY_LENGTH = 1000
export const FEEDBACK_MAX_VIDEO_DURATION_MS = 15_000

export const FEEDBACK_MEDIA_LIMITS = {
  image: {
    bucket: "feedback-images",
    maxBytes: 5_242_880,
    mimes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  },
  video: {
    bucket: "feedback-videos",
    maxBytes: 10_485_760,
    mimes: ["video/mp4", "video/webm"],
  },
} as const
