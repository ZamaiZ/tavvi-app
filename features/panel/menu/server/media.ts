import "server-only"

import { MENU_MEDIA_LIMITS, type MenuMediaKind, type MenuRemovedPath, type MenuUploadTicket } from "../model"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
}

export async function issueMenuUploadTicket({
  restaurantId,
  itemId,
  kind,
  mimeType,
  byteSize,
}: {
  restaurantId: string
  itemId: string
  kind: MenuMediaKind
  mimeType: string
  byteSize: number
}): Promise<MenuUploadTicket | null> {
  const limits = MENU_MEDIA_LIMITS[kind]
  const extension = extensionByMime[mimeType]
  if (!extension || !(limits.mimes as readonly string[]).includes(mimeType) || byteSize <= 0 || byteSize > limits.maxBytes) return null

  const id = crypto.randomUUID()
  const path = `${restaurantId}/${itemId}/${id}.${extension}`
  const supabase = await createSupabaseServerClient("panel")
  const { data, error } = await supabase.storage.from(limits.bucket).createSignedUploadUrl(path, { upsert: false })
  if (error || !data) {
    console.error("[panel-menu] upload ticket failed", { code: error?.name ?? "unknown", kind })
    return null
  }

  return { id, kind, bucket: limits.bucket, path: data.path, token: data.token }
}

export async function removeMenuStorageFiles(files: MenuRemovedPath[]) {
  if (!files.length) return
  try {
    const supabase = await createSupabaseServerClient("panel")
    const grouped = new Map<MenuRemovedPath["bucket"], string[]>()
    for (const file of files) grouped.set(file.bucket, [...(grouped.get(file.bucket) ?? []), file.path])

    const results = await Promise.all([...grouped].map(async ([bucket, paths]) => {
      const { error } = await supabase.storage.from(bucket).remove([...new Set(paths)])
      return { bucket, code: error?.name }
    }))
    for (const result of results) {
      if (result.code) console.warn("[panel-menu] storage cleanup failed", result)
    }
  } catch (cause) {
    console.warn("[panel-menu] storage cleanup failed", cause instanceof Error ? cause.name : "unknown")
  }
}

export async function cleanupMenuUploads(files: MenuRemovedPath[]) {
  await removeMenuStorageFiles(files)
}
