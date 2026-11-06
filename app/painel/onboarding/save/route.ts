import { NextResponse, type NextRequest } from "next/server"

import {
  completePanelRestaurantOnboardingSchema,
  savePanelRestaurantDraftSchema,
} from "@/features/panel/onboarding/schema"
import {
  persistPanelRestaurantProfile,
  type PanelBrandFiles,
} from "@/features/panel/onboarding/server/persistence"

export const runtime = "nodejs"

const maxImageSize = 5 * 1024 * 1024
const maxRequestSize = 10 * 1024 * 1024 + 64 * 1024

function sameOrigin(request: NextRequest) {
  const originValue = request.headers.get("origin")
  const forwardedHost = request.headers.get("x-forwarded-host")
  const host = (forwardedHost || request.headers.get("host") || request.nextUrl.host).split(",")[0].trim()
  if (!originValue || !host) return false
  try {
    return new URL(originValue).host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}

function responseForFailure(code: "invalid_input" | "context_changed" | "storage_policy_denied" | "storage_unavailable" | "unavailable") {
  const status = code === "invalid_input" ? 400 : code === "context_changed" ? 409 : code === "storage_policy_denied" ? 403 : code === "storage_unavailable" ? 502 : 503
  return NextResponse.json({ ok: false, code }, { status })
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return responseForFailure("invalid_input")

  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > maxRequestSize) return responseForFailure("invalid_input")

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 400 })
  }

  // Content-Length may be absent for streamed requests. Bound the parsed fields too.
  let parsedBodySize = 0
  const seenKeys = new Set<string>()
  for (const [key, value] of formData.entries()) {
    if (!["intent", "restaurantId", "expectedRestaurantId", "profile", "step", "logo", "cover"].includes(key)) {
      return responseForFailure("invalid_input")
    }
    if (seenKeys.has(key)) return responseForFailure("invalid_input")
    seenKeys.add(key)
    parsedBodySize += typeof value === "string" ? new TextEncoder().encode(value).byteLength : value.size
    if (parsedBodySize > maxRequestSize) return responseForFailure("invalid_input")
  }

  const intent = formData.get("intent")
  const restaurantId = formData.get("restaurantId")
  const expectedRestaurantId = formData.get("expectedRestaurantId")
  const profileValue = formData.get("profile")
  if (
    (intent !== "draft" && intent !== "complete") ||
    typeof restaurantId !== "string" ||
    typeof expectedRestaurantId !== "string" ||
    typeof profileValue !== "string"
  ) {
    return responseForFailure("invalid_input")
  }

  let profile: unknown
  try {
    profile = JSON.parse(profileValue)
  } catch {
    return responseForFailure("invalid_input")
  }

  const rawFiles: PanelBrandFiles = {}
  for (const slot of ["logo", "cover"] as const) {
    const value = formData.get(slot)
    if (value === null) continue
    if (typeof value === "string" || value.size <= 0 || value.size > maxImageSize) {
      return responseForFailure("invalid_input")
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(value.type)) {
      return responseForFailure("invalid_input")
    }
    const header = new Uint8Array(await value.slice(0, 12).arrayBuffer())
    const isJpeg = value.type === "image/jpeg" && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    const isPng = value.type === "image/png" && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47
    const isWebp = value.type === "image/webp"
      && String.fromCharCode(...header.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...header.slice(8, 12)) === "WEBP"
    if (!isJpeg && !isPng && !isWebp) return responseForFailure("invalid_input")
    rawFiles[slot] = value
  }

  try {
    if (intent === "draft") {
      const parsed = savePanelRestaurantDraftSchema.safeParse({
        restaurantId,
        expectedRestaurantId,
        step: formData.get("step"),
        profile,
      })
      if (!parsed.success || parsed.data.restaurantId !== parsed.data.expectedRestaurantId) {
        return responseForFailure("invalid_input")
      }
      const result = await persistPanelRestaurantProfile({ intent, input: parsed.data }, rawFiles)
      return result.ok ? NextResponse.json(result) : responseForFailure(result.code)
    }

    const parsed = completePanelRestaurantOnboardingSchema.safeParse({
      restaurantId,
      expectedRestaurantId,
      profile,
    })
    if (!parsed.success || parsed.data.restaurantId !== parsed.data.expectedRestaurantId) {
      return responseForFailure("invalid_input")
    }
    const result = await persistPanelRestaurantProfile({ intent, input: parsed.data }, rawFiles)
    return result.ok ? NextResponse.json(result) : responseForFailure(result.code)
  } catch {
    return responseForFailure("unavailable")
  }
}
