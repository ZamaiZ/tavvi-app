import "server-only"

import { createHmac } from "node:crypto"
import { headers } from "next/headers"

import { createSupabasePublicClient } from "@/lib/supabase/public"

type RateLimitBucket = "feedback:start" | "feedback:publish"

async function visitorIdentity(scope: string) {
  const requestHeaders = await headers()
  const trustedAddress = requestHeaders.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim()
  return `${scope}:${trustedAddress || "shared-unknown-visitor"}`
}

export async function checkFeedbackRateLimit({
  key,
  scope,
  bucket,
  max,
}: {
  key: string
  scope: string
  bucket: RateLimitBucket
  max: number
}) {
  const identityHash = createHmac("sha256", key).update(await visitorIdentity(scope)).digest("hex")
  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc("check_feedback_rate_limit", {
    p_key: key,
    p_bucket: bucket,
    p_identity_hash: identityHash,
    p_max: max,
    p_window_seconds: 600,
  })

  if (error) throw new Error("feedback_rate_limit_unavailable")
  return data === true
}
