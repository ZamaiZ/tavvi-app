"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { getPanelPendingServiceCallsCountAction } from "@/features/panel/calls/actions"
import { isCallSoundEnabled, playCallArrivalTone, unlockCallSound } from "@/features/panel/calls/components/call-sound"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js"

type CallsRealtimeValue = {
  pendingCount: number
  connected: boolean
  refresh: () => Promise<void>
}

const CallsRealtimeContext = createContext<CallsRealtimeValue>({
  pendingCount: 0,
  connected: false,
  refresh: async () => undefined,
})

function broadcastPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  const event = value as { payload?: unknown }
  return event.payload && typeof event.payload === "object"
    ? event.payload as Record<string, unknown>
    : value as Record<string, unknown>
}

function insertCallId(value: unknown): string | null {
  const payload = broadcastPayload(value)
  const candidate = payload?.record ?? payload?.new ?? payload
  const row = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null
  return typeof row?.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id) ? row.id : null
}

function isPendingInsert(value: unknown) {
  const payload = broadcastPayload(value)
  const candidate = payload?.record ?? payload?.new ?? payload
  const row = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null
  return row?.status === "pending"
}

export function CallsRealtimeProvider({
  restaurantId,
  initialPendingCount,
  children,
}: {
  restaurantId: string
  initialPendingCount: number
  children: ReactNode
}) {
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(initialPendingCount)
  const [connected, setConnected] = useState(false)

  const sync = useCallback(async (refreshPage = true) => {
    try {
      const result = await getPanelPendingServiceCallsCountAction({ expectedRestaurantId: restaurantId })
      if (result.ok) setPendingCount(result.data)
    } catch {
      setConnected(false)
    } finally {
      if (refreshPage) router.refresh()
    }
  }, [restaurantId, router])

  useEffect(() => {
    setPendingCount(initialPendingCount)
  }, [initialPendingCount, restaurantId])

  useEffect(() => {
    let active = true
    let refreshTimer: number | null = null
    const seenInsertIds = new Set<string>()
    const supabase = createSupabaseBrowserClient("panel")
    const channel = supabase
      .channel(`service_calls:${restaurantId}`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, (event: unknown) => {
        if (!active) return
        const id = insertCallId(event)
        if (id && isPendingInsert(event) && !seenInsertIds.has(id) && isCallSoundEnabled()) {
          playCallArrivalTone()
        }
        if (id) seenInsertIds.add(id)
        scheduleSync()
      })
      .on("broadcast", { event: "UPDATE" }, () => {
        if (active) scheduleSync()
      })
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (!active) return
        setConnected(status === "SUBSCRIBED")
        if (status === "SUBSCRIBED") {
          void sync(false).finally(() => router.refresh())
        }
      })

    const unlockAudio = () => {
      if (isCallSoundEnabled()) void unlockCallSound()
    }
    function scheduleSync() {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        if (active) void sync()
      }, 180)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void sync()
    }
    window.addEventListener("pointerdown", unlockAudio, { passive: true })
    window.addEventListener("keydown", unlockAudio)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      active = false
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      window.removeEventListener("pointerdown", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [restaurantId, router, sync])

  const value = useMemo(() => ({ pendingCount, connected, refresh: () => sync() }), [connected, pendingCount, sync])

  return <CallsRealtimeContext.Provider value={value}>{children}</CallsRealtimeContext.Provider>
}

export function useCallsRealtime() {
  return useContext(CallsRealtimeContext)
}
