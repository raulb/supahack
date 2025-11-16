# Codex Agent Brief

Use this guide when operating the repository via ChatGPT Desktop (Codex) so you understand the available tools, guardrails, and standard workflows.

## Mission Overview

- Frontend: Next.js 14 (App Router) located under `app/`.
- Backend: Supabase Postgres + realtime + edge functions.
- MCP: All database/edge-function operations must go through the **Supabase MCP server** using the provided project URL and keys.

## Environment & Commands

| Task | Command |
| --- | --- |
| Install deps | `npm install` |
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Start (prod) | `npm run start` |
| Lint | `npm run lint` |

Required env vars (`.env.local`, not committed):

```ini
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Supabase MCP Expectations

- **Never** run schema changes directly against Postgres; always issue migrations through MCP (`phase3_submissions_setup`, `phase5_rpcs`, or new ones you create).
- Use MCP for:
  - Enabling extensions (`vector`, `pgcrypto`)
  - Table/RLS changes
  - Creating RPCs
  - Deploying edge functions
  - Managing MCP metadata (`supabase/mcp/tools.json`)

## Available RPC Tools

Defined in `supabase/mcp/tools.json` and callable via MCP:

1. `get_recent_entries(limit_count int)` – latest `submissions`.
2. `search_vectors(query text, match_count int)` – similarity search with `<=>`.
3. `cluster_entries()` – simple two-centroid summary (demo).

Always keep metadata in sync if you add/remove RPCs.

## Edge Function

- `supabase/functions/submit-text/index.ts`
  - Accepts `POST { text }`
  - Inserts into `public.submissions`
  - Generates deterministic placeholder embeddings
  - Updates the same row and returns it
- Deploy via MCP or Supabase CLI (`supabase functions deploy submit-text`).

## Frontend Entry Points

- `app/page.tsx` – landing page linking to `/demo`.
- `app/demo/page.tsx` – client component handling:
  - Input validation & profanity filter
  - `/api/submit` proxy calls
  - Loading recent rows (REST)
  - Supabase realtime subscription (INSERT-only)
  - Non-overlapping bubble layout with deterministic slots/colors
- `app/api/submit/route.ts` – server proxy that calls the edge function with the service-role key.

## Guardrails

- Respect `.gitignore`; `.env.local` and other secrets must never be committed.
- Maintain TypeScript strictness and run `npm run lint` after meaningful frontend changes.
- Realtime channels should be unsubscribed on cleanup (`supabase.removeChannel` already in place).
- Only G-rated submissions allowed; profanity filter must remain in `handleSubmit`.

## Adding New Tools/Features

1. Define SQL via MCP migration (`mcp_supabase_apply_migration`).
2. Document new RPCs inside `supabase/mcp/tools.json`.
3. If new edge functions are added, include deployment guidance in `README.md`.

Following this checklist keeps Codex aligned with the project’s security and workflow constraints.***

