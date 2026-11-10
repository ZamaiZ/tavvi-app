export type CompressionResult = { blob: Blob; width: number; height: number }

export async function compressMenuImage(file: File): Promise<CompressionResult> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Não foi possível preparar esta imagem no navegador.")
    context.drawImage(bitmap, 0, 0, width, height)
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86))
    if (!compressed) throw new Error("O navegador não conseguiu preparar esta imagem.")
    return compressed.size < file.size
      ? { blob: compressed, width, height }
      : { blob: file, width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

export async function compressMenuVideo(
  file: File,
  onProgress: (progress: number) => void,
): Promise<CompressionResult | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return null
  try {
    const {
      ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input,
      Mp4OutputFormat, Output, QUALITY_HIGH,
    } = await import("mediabunny")
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
    const track = await input.getPrimaryVideoTrack()
    if (!track) return null
    const scale = Math.min(1, 1280 / Math.max(track.displayWidth, track.displayHeight))
    const width = Math.max(1, Math.round(track.displayWidth * scale))
    const height = Math.max(1, Math.round(track.displayHeight * scale))
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
    const conversion = await Conversion.init({
      input,
      output,
      video: { width, height, codec: "avc", quality: QUALITY_HIGH, keyFrameInterval: 2 },
      audio: { discard: true },
    })
    if (!conversion.isValid) return null
    conversion.onProgress = (progress) => onProgress(Math.round(progress * 100))
    await conversion.execute()
    const buffer = output.target.buffer
    if (!buffer) return null
    const blob = new Blob([buffer], { type: "video/mp4" })
    return blob.size < file.size ? { blob, width, height } : null
  } catch {
    return null
  }
}
