import "server-only"

import { cookies } from "next/headers"

export const ACTIVE_PANEL_RESTAURANT_COOKIE = "active_restaurant_id"

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && uuidPattern.test(value)
}

export async function getActivePanelRestaurantId() {
  const cookieStore = await cookies()
  const value = cookieStore.get(ACTIVE_PANEL_RESTAURANT_COOKIE)?.value
  return isUuid(value) ? value : null
}

export async function setActivePanelRestaurantId(restaurantId: string) {
  if (!isUuid(restaurantId)) throw new Error("Invalid restaurant context.")
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_PANEL_RESTAURANT_COOKIE, restaurantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

export async function clearActivePanelRestaurantId() {
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_PANEL_RESTAURANT_COOKIE)
}
