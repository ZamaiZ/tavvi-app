"use server"

import { publicServiceCallSchema } from "./calls-schema"
import type { PublicServiceCallActionResult, PublicServiceCallDTO, PublicServiceCallRequestDTO } from "./calls-model"
import { getPublicServiceCallStatus, requestPublicServiceCall } from "./server/public-calls"

function invalidInput<T>(): PublicServiceCallActionResult<T> {
  return { ok: false, code: "invalid_input" }
}

export async function getPublicServiceCallStatusAction(rawInput: unknown): Promise<PublicServiceCallActionResult<PublicServiceCallDTO | null>> {
  const parsed = publicServiceCallSchema.safeParse(rawInput)
  return parsed.success ? getPublicServiceCallStatus(parsed.data.token) : invalidInput()
}

export async function requestPublicServiceCallAction(rawInput: unknown): Promise<PublicServiceCallActionResult<PublicServiceCallRequestDTO>> {
  const parsed = publicServiceCallSchema.safeParse(rawInput)
  return parsed.success ? requestPublicServiceCall(parsed.data.token) : invalidInput()
}
