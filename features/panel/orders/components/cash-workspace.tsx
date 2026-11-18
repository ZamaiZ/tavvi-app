"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js"

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export function CashRealtimeProvider({ restaurantId, children }: { restaurantId: string; children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    let active = true
    let refreshTimer: number | null = null
    const supabase = createSupabaseBrowserClient("panel")
    const channel = supabase
      .channel(`comandas:${restaurantId}`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, scheduleRefresh)
      .on("broadcast", { event: "UPDATE" }, scheduleRefresh)
      .on("broadcast", { event: "DELETE" }, scheduleRefresh)
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (!active) return
        if (status === "SUBSCRIBED") router.refresh()
      })

    function scheduleRefresh() {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        if (active) router.refresh()
      }, 180)
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") router.refresh()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      active = false
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [restaurantId, router])

  return children
}
