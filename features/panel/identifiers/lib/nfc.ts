"use client"

type NDEFRecordLike = {
  recordType: string
  data: ArrayBuffer | ArrayBufferView
}

type NDEFReadingEventLike = Event & {
  serialNumber: string
  message: { records: NDEFRecordLike[] }
}

type NDEFReaderLike = EventTarget & {
  scan(options?: { signal?: AbortSignal }): Promise<void>
  write(message: { records: Array<{ recordType: "url"; data: string }> }, options?: { signal?: AbortSignal }): Promise<void>
  makeReadOnly(options?: { signal?: AbortSignal }): Promise<void>
}

type NfcWindow = Window & { NDEFReader?: new () => NDEFReaderLike }
type ReaderSession = {
  reader: NDEFReaderLike
  initialSerial: string | null
  observedSerial: string | null
  currentUrl: string | null
  operationController: AbortController | null
  scanController: AbortController
}

export type IdentifierNfcFailure =
  | "secure_context_required"
  | "unsupported"
  | "lock_unsupported"
  | "permission_denied"
  | "nfc_unavailable"
  | "tag_unreadable"
  | "serial_unavailable"
  | "serial_unsupported"
  | "serial_mismatch"
  | "serial_unconfirmed"
  | "tag_content_mismatch"
  | "write_failed"
  | "lock_failed"
  | "operation_aborted"
  | "reader_expired"
  | "timeout"

export type IdentifierTagRead = { serial: string; url: string | null }

const activeReaders = new WeakMap<AbortSignal, ReaderSession>()
const NFC_FAILURE_CODES: readonly IdentifierNfcFailure[] = [
  "secure_context_required", "unsupported", "lock_unsupported", "permission_denied", "nfc_unavailable",
  "tag_unreadable", "serial_unavailable", "serial_unsupported", "serial_mismatch", "serial_unconfirmed",
  "tag_content_mismatch", "write_failed", "lock_failed", "operation_aborted", "reader_expired", "timeout",
]

function nfcWindow() {
  return window as NfcWindow
}

function createReader() {
  if (!window.isSecureContext) throw new Error("secure_context_required")
  const Reader = nfcWindow().NDEFReader
  if (!Reader) throw new Error("unsupported")
  const reader = new Reader()
  if (typeof reader.makeReadOnly !== "function") throw new Error("lock_unsupported")
  return reader
}

export function getIdentifierNfcSupport(): IdentifierNfcFailure | "supported" {
  if (typeof window === "undefined" || !window.isSecureContext) return "secure_context_required"
  const Reader = nfcWindow().NDEFReader
  if (!Reader) return "unsupported"
  try {
    if (typeof new Reader().makeReadOnly !== "function") return "lock_unsupported"
  } catch {
    return "nfc_unavailable"
  }
  return "supported"
}

export function normalizeIdentifierNfcSerial(value: string): string {
  const serial = value.replace(/[:-]/g, "").toUpperCase()
  if (!serial) throw new Error("serial_unavailable")
  if (!/^[0-9A-F]{14}$/.test(serial)) throw new Error("serial_unsupported")
  return serial
}

function readUrlRecord(message: { records: NDEFRecordLike[] }): string | null {
  for (const record of message.records) {
    if (record.recordType !== "url") continue
    try {
      const url = new TextDecoder().decode(record.data)
      const parsed = new URL(url)
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return url
    } catch {
      return null
    }
  }
  return null
}

function errorCode(error: unknown, fallback: IdentifierNfcFailure): IdentifierNfcFailure {
  if (error instanceof Error && NFC_FAILURE_CODES.includes(error.message as IdentifierNfcFailure)) {
    return error.message as IdentifierNfcFailure
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "permission_denied"
    if (error.name === "NotSupportedError") return "nfc_unavailable"
    if (error.name === "AbortError") return "operation_aborted"
  }
  return fallback
}

export async function readIdentifierTag(signal: AbortSignal): Promise<IdentifierTagRead> {
  const reader = createReader()
  const scanController = new AbortController()
  const session: ReaderSession = {
    reader,
    initialSerial: null,
    observedSerial: null,
    currentUrl: null,
    operationController: null,
    scanController,
  }
  activeReaders.set(signal, session)

  return new Promise((resolve, reject) => {
    let settled = false
    let timeoutId: number | null = null
    const removeListeners = () => {
      reader.removeEventListener("reading", onReading)
      reader.removeEventListener("readingerror", onReadingError)
      scanController.signal.removeEventListener("abort", onScanAbort)
      signal.removeEventListener("abort", onAbort)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
    const fail = (code: IdentifierNfcFailure) => {
      if (settled) return
      settled = true
      removeListeners()
      scanController.abort()
      activeReaders.delete(signal)
      reject(new Error(code))
    }
    const onReading = (event: Event) => {
      try {
        const reading = event as NDEFReadingEventLike
        const serial = normalizeIdentifierNfcSerial(reading.serialNumber)
        session.observedSerial = serial
        session.currentUrl = readUrlRecord(reading.message)
        if (session.initialSerial === null) {
          session.initialSerial = serial
          settled = true
          if (timeoutId !== null) window.clearTimeout(timeoutId)
          resolve({ serial, url: session.currentUrl })
          return
        }
        if (serial !== session.initialSerial) session.operationController?.abort()
      } catch (error) {
        if (session.initialSerial === null) fail(errorCode(error, "tag_unreadable"))
        else {
          session.observedSerial = null
          session.operationController?.abort()
        }
      }
    }
    const onReadingError = () => {
      if (session.initialSerial === null) fail("tag_unreadable")
      else {
        session.observedSerial = null
        session.operationController?.abort()
      }
    }
    const onScanAbort = () => {
      if (session.initialSerial === null) fail("operation_aborted")
    }
    const onAbort = () => {
      scanController.abort()
      if (session.operationController) session.operationController.abort()
      removeListeners()
      activeReaders.delete(signal)
      if (!settled) {
        settled = true
        reject(new Error("operation_aborted"))
      }
    }

    reader.addEventListener("reading", onReading)
    reader.addEventListener("readingerror", onReadingError)
    scanController.signal.addEventListener("abort", onScanAbort, { once: true })
    signal.addEventListener("abort", onAbort, { once: true })
    timeoutId = window.setTimeout(() => fail("timeout"), 30000)
    reader.scan({ signal: scanController.signal }).catch((error) => {
      if (session.initialSerial === null) fail(errorCode(error, "nfc_unavailable"))
      else {
        session.observedSerial = null
        session.operationController?.abort()
      }
    })
  })
}

export function isIdentifierTagStillSelected(signal: AbortSignal, expectedSerial: string): boolean {
  const session = activeReaders.get(signal)
  return Boolean(
    session
    && !signal.aborted
    && session.initialSerial === expectedSerial
    && session.observedSerial === expectedSerial,
  )
}

function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  failure: IdentifierNfcFailure,
  controller: AbortController,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(failure))
      queueMicrotask(() => controller.abort())
    }, milliseconds)
    promise.then(
      (value) => { window.clearTimeout(timeoutId); resolve(value) },
      (error) => { window.clearTimeout(timeoutId); reject(error) },
    )
  })
}

export async function writeAndProtectIdentifierTag(
  url: string,
  expectedSerial: string,
  signal: AbortSignal,
  onPhysicalStart: () => Promise<void>,
): Promise<void> {
  const session = activeReaders.get(signal)
  if (!session) throw new Error("reader_expired")
  const serial = normalizeIdentifierNfcSerial(expectedSerial)
  if (!isIdentifierTagStillSelected(signal, serial)) throw new Error("serial_mismatch")
  if (signal.aborted) throw new Error("operation_aborted")

  const operationController = new AbortController()
  session.operationController = operationController
  const abortFromParent = () => operationController.abort()
  signal.addEventListener("abort", abortFromParent, { once: true })

  try {
    let physicalStarted = false
    const beginPhysicalOperation = async () => {
      if (physicalStarted) return
      if (signal.aborted || operationController.signal.aborted) throw new Error("operation_aborted")
      await onPhysicalStart()
      if (!isIdentifierTagStillSelected(signal, serial)) throw new Error("serial_mismatch")
      if (signal.aborted || operationController.signal.aborted) throw new Error("operation_aborted")
      physicalStarted = true
    }

    if (session.currentUrl !== url) {
      await beginPhysicalOperation()
      let writePromise: Promise<void>
      try {
        writePromise = session.reader.write({ records: [{ recordType: "url", data: url }] }, { signal: operationController.signal })
      } catch (error) {
        throw new Error(errorCode(error, "write_failed"))
      }
      await withTimeout(writePromise, 30000, "timeout", operationController)
        .catch((error) => { throw new Error(errorCode(error, "write_failed")) })
    }

    if (!isIdentifierTagStillSelected(signal, serial)) throw new Error("serial_mismatch")
    if (signal.aborted || operationController.signal.aborted) throw new Error("operation_aborted")

    await beginPhysicalOperation()
    let lockPromise: Promise<void>
    try {
      lockPromise = session.reader.makeReadOnly({ signal: operationController.signal })
    } catch (error) {
      throw new Error(errorCode(error, "lock_failed"))
    }
    await withTimeout(lockPromise, 8000, "timeout", operationController)
      .catch((error) => { throw new Error(errorCode(error, "lock_failed")) })
  } catch (error) {
    operationController.abort()
    const failure = session.observedSerial === null
      ? "serial_unconfirmed"
      : session.observedSerial !== serial
        ? "serial_mismatch"
        : errorCode(error, "lock_failed")
    throw new Error(failure)
  } finally {
    signal.removeEventListener("abort", abortFromParent)
    if (session.operationController === operationController) session.operationController = null
  }
}

export async function protectSelectedIdentifierTag(
  expected: { serial: string; url: string },
  signal: AbortSignal,
  onLockStarted: () => Promise<void>,
): Promise<void> {
  const session = activeReaders.get(signal)
  if (!session) throw new Error("reader_expired")
  const expectedSerial = normalizeIdentifierNfcSerial(expected.serial)
  if (signal.aborted) throw new Error("operation_aborted")
  if (session.initialSerial !== expectedSerial || session.observedSerial !== expectedSerial) throw new Error("serial_mismatch")
  if (session.currentUrl !== expected.url) throw new Error("tag_content_mismatch")

  const operationController = new AbortController()
  session.operationController = operationController
  const abortFromParent = () => operationController.abort()
  signal.addEventListener("abort", abortFromParent, { once: true })

  try {
    if (session.observedSerial !== expectedSerial) throw new Error("serial_mismatch")
    if (session.currentUrl !== expected.url) throw new Error("tag_content_mismatch")
    if (signal.aborted || operationController.signal.aborted) throw new Error("operation_aborted")

    await onLockStarted()
    if (session.observedSerial !== expectedSerial) throw new Error("serial_mismatch")
    if (session.currentUrl !== expected.url) throw new Error("tag_content_mismatch")
    if (signal.aborted || operationController.signal.aborted) throw new Error("operation_aborted")
    let lockPromise: Promise<void>
    try {
      lockPromise = session.reader.makeReadOnly({ signal: operationController.signal })
    } catch (error) {
      throw new Error(errorCode(error, "lock_failed"))
    }
    await withTimeout(lockPromise, 8000, "timeout", operationController)
  } catch (error) {
    operationController.abort()
    const failure = session.observedSerial === null
      ? "serial_unconfirmed"
      : session.observedSerial !== expectedSerial
        ? "serial_mismatch"
        : errorCode(error, "lock_failed")
    throw new Error(failure)
  } finally {
    signal.removeEventListener("abort", abortFromParent)
    if (session.operationController === operationController) session.operationController = null
  }
}
