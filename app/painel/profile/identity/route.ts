import { NextResponse, type NextRequest } from "next/server"

import { activeIdentitySchema } from "@/features/panel/profile/schema"
import { persistActiveRestaurantIdentity, type BrandFiles, type ProfileWriteCode } from "@/features/panel/profile/server/persistence"

export const runtime = "nodejs"

const maxImageSize = 5 * 1024 * 1024
const maxRequestSize = 10 * 1024 * 1024 + 32 * 1024

function sameOrigin(request: NextRequest) {
  const originValue = request.headers.get("origin")
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host).split(",")[0].trim()
  if (!originValue || !host) return false
  try { return new URL(originValue).host.toLowerCase() === host.toLowerCase() } catch { return false }
}

function responseFailure(code: ProfileWriteCode, status?: number) {
  const responseStatus = status ?? (code === "invalid_input" ? 400 : code === "session_expired" ? 401 : code === "context_changed" ? 409 : code === "storage_policy_denied" ? 403 : 503)
  return NextResponse.json({ ok: false, code }, { status: responseStatus, headers: { "Cache-Control": "private, no-store" } })
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return responseFailure("invalid_input", 403)
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > maxRequestSize) return responseFailure("invalid_input")

  let formData: FormData
  try { formData = await request.formData() } catch { return responseFailure("invalid_input") }

  const seen = new Set<string>()
  let totalSize = 0
  for (const [key, value] of formData.entries()) {
    if (!["restaurantId", "expectedRestaurantId", "identity", "logo", "cover"].includes(key) || seen.has(key)) return responseFailure("invalid_input")
    seen.add(key)
    totalSize += typeof value === "string" ? new TextEncoder().encode(value).byteLength : value.size
    if (totalSize > maxRequestSize) return responseFailure("invalid_input")
  }

  const restaurantId = formData.get("restaurantId")
  const expectedRestaurantId = formData.get("expectedRestaurantId")
  const identityValue = formData.get("identity")
  if (typeof restaurantId !== "string" || typeof expectedRestaurantId !== "string" || typeof identityValue !== "string" || restaurantId !== expectedRestaurantId) return responseFailure("invalid_input")

  let rawIdentity: unknown
  try { rawIdentity = JSON.parse(identityValue) } catch { return responseFailure("invalid_input") }
  const parsedIdentity = activeIdentitySchema.safeParse(rawIdentity)
  if (!parsedIdentity.success) return responseFailure("invalid_input")

  const files: BrandFiles = {}
  for (const slot of ["logo", "cover"] as const) {
    const value = formData.get(slot)
    if (value === null) continue
    if (typeof value === "string" || value.size <= 0 || value.size > maxImageSize || !["image/jpeg", "image/png", "image/webp"].includes(value.type)) return responseFailure("invalid_input")
    const header = new Uint8Array(await value.slice(0, 12).arrayBuffer())
    const jpeg = value.type === "image/jpeg" && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    const png = value.type === "image/png" && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47
    const webp = value.type === "image/webp" && String.fromCharCode(...header.slice(0, 4)) === "RIFF" && String.fromCharCode(...header.slice(8, 12)) === "WEBP"
    if (!jpeg && !png && !webp) return responseFailure("invalid_input")
    files[slot] = value
  }

  try {
    const result = await persistActiveRestaurantIdentity(restaurantId, parsedIdentity.data, files)
    if (!result.ok) return responseFailure(result.code)
    return NextResponse.json({ ok: true, identity: result.identity, savedPaths: result.savedPaths }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (cause) {
    console.error("[panel-profile]", JSON.stringify({ stage: "identity_route", name: cause instanceof Error ? cause.name : undefined }))
    return responseFailure("unavailable")
  }
}
