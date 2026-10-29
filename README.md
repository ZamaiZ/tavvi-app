# Tavvi app

Next.js app for the Tavvi platform. This phase establishes local infrastructure and Preview/demo configuration; product pages and database schema are added in later approved steps.

## Local development

Prerequisites:

- Node.js 22.22.2
- pnpm 10.34.5
- Docker Desktop running

From the project root:

1. Install dependencies with pnpm install.
2. Start the local Supabase stack with pnpm supabase start. The first run downloads several Docker images and may take a few minutes.
3. Copy only the local API URL and PUBLISHABLE_KEY values printed by Supabase into the ignored .env.local as NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Do not copy SECRET_KEY, SERVICE_ROLE_KEY, JWT_SECRET, or any other local secret into the app environment or share the full status output.
4. Start Next.js with pnpm dev.

Local surfaces:

- Public app: http://localhost:3000
- Platform Admin: http://admin.localhost:3000
- Restaurant panel: http://painel.localhost:3000
- Supabase Studio: http://127.0.0.1:54323

Use pnpm supabase status to inspect the local stack and pnpm supabase stop to stop it. Local Supabase data lives in Docker volumes and is separate from all hosted projects.

## Environments

- Local development uses Supabase CLI and Docker.
- The existing empty Supabase project in São Paulo is for demo/staging only. Its public URL and publishable key will be configured in Vercel Preview variables scoped to the preview Git branch.
- Other preview branches do not receive Supabase project variables.
- The GitHub repository is ZamaiZ/tavvi-app. Work on preview. The master branch does not exist yet and will be created only when Production is provisioned.
- Production will use a separate Supabase project. Never copy Preview credentials into Production.
- Vercel Functions use gru1 while the remote Supabase primary is in São Paulo.

The app uses Next.js as its only application runtime. Express, Web Push, VAPID values, and APP_SERVER_KEY are not part of this setup.