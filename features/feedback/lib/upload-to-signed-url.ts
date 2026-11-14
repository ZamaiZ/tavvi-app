export async function uploadToSignedUrl(url: string, blob: Blob, mimeType: string) {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "x-upsert": "false",
    },
    body: blob,
    credentials: "omit",
    cache: "no-store",
  })

  if (!response.ok) throw new Error("feedback_upload_failed")
}
