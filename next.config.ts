import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    allowedDevOrigins: ["marleen-interthronging-synergistically.ngrok-free.dev"],
    experimental: {
        agentUpgrade: "security",
    },
}

export default nextConfig
