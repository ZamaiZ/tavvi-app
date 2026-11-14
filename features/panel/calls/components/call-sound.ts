"use client"

const SOUND_STORAGE_KEY = "tavvi-service-call-sound"

let audioContext: AudioContext | null = null
let soundEnabledInMemory: boolean | null = null

function getAudioContext() {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null
  audioContext ??= new window.AudioContext()
  return audioContext
}

export function isCallSoundEnabled() {
  if (typeof window === "undefined") return false
  if (soundEnabledInMemory !== null) return soundEnabledInMemory
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export async function setCallSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return
  soundEnabledInMemory = enabled
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off")
  } catch {
    // The in-memory switch still works when browser storage is unavailable.
  }

  if (!enabled) return
  await unlockCallSound()
}

export async function unlockCallSound() {
  if (!isCallSoundEnabled()) return
  try {
    const context = getAudioContext()
    if (context?.state === "suspended") await context.resume().catch(() => undefined)
  } catch {
    // Unsupported or blocked audio leaves the rest of the call queue usable.
  }
}

export function playCallArrivalTone() {
  try {
    const context = getAudioContext()
    if (!context || context.state !== "running") return

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startAt = context.currentTime
    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(740, startAt)
    oscillator.frequency.setValueAtTime(920, startAt + 0.075)
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.19)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + 0.2)
  } catch {
    // Audio feedback is optional and must not interrupt queue updates.
  }
}
