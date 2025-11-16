# Chato — Supabase Realtime Ideas Wall

A Next.js 14 demo that streams audience “idea” submissions into Supabase, renders them as floating iOS-style bubbles, and exposes database helpers through Supabase MCP tools for AI agents (e.g. ChatGPT Desktop Codex).

## Features

- **Live submissions**: `/api/submit` calls the `submit-text` Supabase Edge Function, which inserts a row and generates a 1536‑dim embedding.
- **Realtime updates**: the client subscribes to `submissions` via Supabase Realtime and maps rows into non-overlapping message bubbles.
- **Vector-ready schema**: `vector` + `pgcrypto` extensions, `submissions.embedding vector(1536)` column, and helper RPCs for recent entries, vector similarity, and toy clustering.
- **MCP integration**: RPCs are described in `supabase/mcp/tools.json` so Codex can call them as tools through the Supabase MCP server.

## Prerequisites

- Node.js 18+ and npm
- Supabase project with:
  - Realtime enabled
  - `vector` and `pgcrypto` extensions
  - Edge Runtime access for deploying functions
- Supabase MCP server connection details (URL + keys)

## Local Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Create `.env.local` with the Supabase credentials for this project:

   ```ini
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   `.env.local` is git-ignored; keep the real values out of commits.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000/demo to submit ideas and observe live updates.

4. **Lint**

   ```bash
   npm run lint
   ```

## Supabase MCP Workflow

All database work is executed through the Supabase MCP server so Codex/ChatGPT Desktop can reason about migrations and tools:

1. **Connect** using the project URL + anon/service keys provided.
2. **Migrations** (already applied, but re-runnable):
   - `phase3_submissions_setup`: enables extensions, creates `public.submissions`, RLS policy, and adds the table to `supabase_realtime`.
   - `phase5_rpcs`: adds `demo_text_embedding`, `get_recent_entries`, `search_vectors`, and `cluster_entries`.
3. **Edge Function**: deploy `supabase/functions/submit-text/index.ts` (either via Supabase CLI or MCP deploy command) so `/api/submit` has a backend target.
4. **MCP Tools Metadata**: `supabase/mcp/tools.json` registers each RPC as a `supabase-rpc` tool, letting Codex call them with structured params.

## Available RPC Tools

| Function | Purpose | Notes |
| --- | --- | --- |
| `get_recent_entries(limit_count int)` | Latest `submissions` rows ordered by `created_at DESC`. | Uses `greatest(limit_count, 1)` for safety. |
| `search_vectors(query text, match_count int)` | Vector similarity search against stored embeddings using `<=>`. | Generates a deterministic placeholder embedding via `demo_text_embedding`. |
| `cluster_entries()` | Simple dual-centroid clustering for demo visualizations. | Returns cluster id, centroid, member ids & counts. |

## Edge Function: `submit-text`

Located at `supabase/functions/submit-text/index.ts`:

1. Validates `POST { text }`.
2. Inserts into `public.submissions`.
3. Generates a demo embedding (deterministic hash-based vector) and updates the row.
4. Returns the updated record as JSON.

Deploy with the Supabase CLI:

```bash
supabase functions deploy submit-text --project-ref <project_ref>
```

Or trigger deployment through the Supabase MCP edge-function API if running inside ChatGPT Desktop.

## Frontend Notes

- `app/demo/page.tsx` is a client component that:
  - Loads the latest submissions once on mount.
  - Subscribes to `INSERT` events for new rows.
  - Deduplicates by `id` and constrains display slots to avoid overlap.
  - Enforces a lightweight profanity filter before sending text to `/api/submit`.
- `lib/supabaseClient.ts` instantiates a shared browser Supabase client with `persistSession: false`.
- `/app/api/submit/route.ts` serves as a proxy so the browser never holds the service-role key.

## Deploying the Web App

1. Provision environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in your hosting provider.
2. Build and run via the standard Next.js commands:

   ```bash
   npm run build
   npm run start
   ```

3. Ensure the Supabase Edge Function is deployed and the MCP tools metadata is accessible to whichever agent will control Codex.

## Troubleshooting

- **Realtime not updating**: confirm `submissions` is part of the `supabase_realtime` publication and the client URL/key match your project.
- **RPC tool errors**: verify the Supabase MCP server is pointed at `supabase/mcp/tools.json` and that the functions exist in the `public` schema.
- **Embedding mismatch**: `demo_text_embedding` is deterministic but purely for demos; swap it for a real embedding model when needed.

Enjoy showcasing Supabase’s realtime + AI tooling!

