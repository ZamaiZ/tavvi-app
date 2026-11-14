import "server-only"

import { createHash, randomBytes } from "node:crypto"

export function createTeamInviteToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHashHex: hashTeamInviteToken(token) }
}

export function hashTeamInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
