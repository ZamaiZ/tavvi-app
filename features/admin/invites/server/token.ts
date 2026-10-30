import "server-only"

import { createHash, randomBytes } from "node:crypto"

export function createPlatformInviteToken() {
  const token = randomBytes(32).toString("base64url")
  const tokenHashHex = hashPlatformInviteToken(token)

  return { token, tokenHashHex }
}

export function hashPlatformInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
