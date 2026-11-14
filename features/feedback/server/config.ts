import "server-only"

export function getFeedbackServerKey() {
  const key = process.env.APP_SERVER_KEY?.trim()
  if (!key || key.length < 32) throw new Error("feedback_server_key_missing")
  return key
}
