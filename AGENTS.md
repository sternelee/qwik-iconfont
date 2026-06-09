# Repository Guidelines

> AI assistant reference for the `qwik-iconfont` project.

## Project Overview

`qwik-iconfont` is an open-source SVG icon-set manager and icon-font generator. Users can create icon projects, upload or import SVGs, edit icons and colors, generate font assets (TTF, CSS, Symbol SVG, demo HTML), publish public icon sets, fork/favorite community projects, and use SaaS features including authentication, quotas, API tokens, webhooks, and collaboration.

**Stack**: Qwik City SSR + Vite + Cloudflare Workers + D1 + R2 + Drizzle ORM + Tailwind CSS v4 + daisyUI.

**Language**: The UI is primarily in Chinese (zh-CN). Comments and documentation mix Chinese and English.

## Architecture & Data Flow

### Core Flow

```text
Upload/import/generate SVG
  -> Store SVG content in R2 (or localStorage in anonymous mode)
  -> Persist project/icon metadata in D1 (or localStorage)
  -> Client-side font generation with svg2ttf / COLRv0 helpers
  -> Download ZIP/TTF/CSS/Symbol SVG/Demo HTML or publish assets to R2
```

### Main Runtime Modes

| Command      | Port   | Database                 | Storage                | Auth                            | Use case                          |
| ------------ | ------ | ------------------------ | ---------------------- | ------------------------------- | --------------------------------- |
| `pnpm dev`   | `5173` | In-memory `MockExecutor` | In-memory `MockBucket` | None (anonymous `localStorage`) | Quick UI dev, anonymous flows     |
| `pnpm serve` | `8788` | D1 (local)               | R2 (local)             | better-auth + OAuth             | Full Workers runtime, auth, D1/R2 |

- `pnpm dev` uses Vite SSR with in-memory mocks. Auth-dependent features are limited.
- `pnpm serve` runs Wrangler dev with full D1/R2, better-auth, OAuth, API tokens, and webhooks.
- Production builds target Cloudflare Workers via `adapters/cloudflare-workers/vite.config.ts`.

### Key Directories

| Directory         | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `src/lib/`        | DB, auth, storage, types, local storage, AI, font generation      |
| `src/routes/`     | Qwik City pages and API endpoints                                 |
| `src/components/` | Reusable UI components and feature widgets                        |
| `src/types/`      | External/library type declarations                                |
| `drizzle/`        | D1 migration SQL and Drizzle metadata                             |
| `adapters/`       | Cloudflare Workers build adapter config                           |
| `figma-plugin/`   | Figma plugin manifest, UI, and plugin code (excluded from ESLint) |
| `docs/`           | Project documentation (design system)                             |
| `public/`         | Static assets including fonts, icons, manifest, robots.txt        |
| `scripts/`        | Post-build scripts (`fix-worker-import.mjs`)                      |

### Entry Points

- `src/root.tsx` — Qwik root document (sets `lang="zh-CN"`, theme anti-FOUC script).
- `src/entry.ssr.tsx` — SSR renderer.
- `src/entry.dev.tsx` — Vite dev entry.
- `src/entry.preview.tsx` — Node preview server entry.
- `src/entry.cloudflare-pages.tsx` — Cloudflare Worker request entry.

## Technology Stack

| Layer          | Technology                                               |
| -------------- | -------------------------------------------------------- |
| Framework      | Qwik City v1.20 (SSR, file-based routing)                |
| Build Tool     | Vite 8                                                   |
| UI Styling     | Tailwind CSS v4 + daisyUI v5                             |
| Database       | Cloudflare D1 (SQLite) / `MockExecutor` for dev          |
| ORM            | Drizzle ORM + drizzle-kit                                |
| Object Storage | Cloudflare R2 / `MockBucket` for dev                     |
| Auth           | better-auth (email/password + GitHub + Google OAuth)     |
| Runtime        | Cloudflare Workers (`node_compat`)                       |
| Font Gen       | svg2ttf, svgpath, opentype.js (client-side)              |
| AI             | OpenAI-compatible API or Cloudflare Workers AI           |
| Icons          | Stroke 2px, round-cap/round-join, `currentColor` default |

## Build, Test & Deploy Commands

```bash
# Development
pnpm dev              # Vite SSR dev server (mock DB/R2, anonymous mode)
pnpm start            # Same as dev, but opens browser
pnpm dev.debug        # Dev server with Node inspector breakpoint
pnpm serve            # Wrangler dev server (D1/R2/auth/full Workers runtime)

# Build
pnpm build            # Production build (client + server)
pnpm build.client     # Client-only build
pnpm build.server     # Worker SSR build + import patch (runs fix-worker-import.mjs)
pnpm build.preview    # Preview SSR build
pnpm build.types      # TypeScript check (tsc --incremental --noEmit)

# Preview
pnpm preview          # Build preview then open Vite preview
pnpm preview:wrangler # Build then run wrangler dev

# QA
pnpm lint             # ESLint over src/**/*.ts*
pnpm fmt              # Prettier write
pnpm fmt.check        # Prettier check

# Database
pnpm db:generate      # Generate Drizzle migration after schema changes
pnpm db:migrate       # Apply D1 migrations locally
pnpm db:migrate:remote # Apply D1 migrations remotely
pnpm cf-typegen       # Generate Cloudflare binding types

# Deploy
pnpm deploy           # wrangler deploy
```

### Build Gotchas

- `pnpm build.server` runs `scripts/fix-worker-import.mjs` as a post-build step. It patches `dist/_worker.js` so `import "server/entry.cloudflare-pages"` becomes a relative import (`./server/entry.cloudflare-pages`) that wrangler can resolve.
- `tsconfig.json` is typecheck-only: `noEmit: true` + `outDir: "tmp"`. `pnpm build.types` never writes production JS.
- `pnpm-workspace.yaml` is **not** a monorepo manifest — it only declares `allowBuilds` for native modules. Do not add a `packages` entry.

## Code Organization

### `src/lib/` — Core Library

| File                             | Purpose                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/schema.ts`              | Drizzle schema. better-auth tables: `user`, `session`, `account`, `verification`. App tables: `projects`, `icons`, `favorites`, `api_tokens`, `project_members`, `webhooks` |
| `src/lib/db.ts`                  | D1 adapter, D1 Date binding wrapper, mock SQLite proxy (`MockExecutor`), `initDB` fallback                                                                                  |
| `src/lib/storage.ts`             | R2 bucket abstraction and in-memory `MockBucket`; `uploadSVG`, `getSVG`, `deleteSVG`                                                                                        |
| `src/lib/auth.ts`                | better-auth configuration, OAuth providers, welcome email (Resend)                                                                                                          |
| `src/lib/auth-client.ts`         | Thin fetch wrapper around better-auth for sign-up/in/out, get-session                                                                                                       |
| `src/lib/session.ts`             | Server-side session lookup for loaders/actions/routes (`getSessionFromRequest`)                                                                                             |
| `src/lib/api-auth.ts`            | Bearer token extraction and SHA-256 token user resolution                                                                                                                   |
| `src/lib/quota.ts`               | Free/Pro quota rules (`maxProjects`, `maxIconsPerProject`)                                                                                                                  |
| `src/lib/font-gen.ts`            | Monochrome SVG→TTF, CSS, Symbol SVG, demo HTML generation; auto-detects COLR                                                                                                |
| `src/lib/colr-font-gen.ts`       | COLRv0 + CPAL colored font generation (injects tables into TTF binary)                                                                                                      |
| `src/lib/svg-color-extractor.ts` | Color layer extraction for multi-color SVG editing (browser-only, DOMParser)                                                                                                |
| `src/lib/ai.ts`                  | AI SVG generation/modify provider helpers (OpenAI-compatible + CF Workers AI)                                                                                               |
| `src/lib/ai-settings.ts`         | Client-side AI provider/API-key settings (localStorage)                                                                                                                     |
| `src/lib/local-storage.ts`       | Anonymous local project/icon persistence                                                                                                                                    |
| `src/lib/local-migration.ts`     | One-way import of anonymous localStorage projects into user account                                                                                                         |
| `src/lib/github-registry.ts`     | GitHub tree fetch/cache/import helpers                                                                                                                                      |
| `src/lib/webhook.ts`             | Webhook dispatch helpers (HMAC signature)                                                                                                                                   |
| `src/lib/types.ts`               | App interfaces, `parseTags`/`formatTags`, SVG viewBox helpers                                                                                                               |

### `src/routes/` — Pages

| Path                                                | Purpose                                                      |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `src/routes/index.tsx`                              | Home dashboard, local/server projects, import, featured sets |
| `src/routes/project/[id]/index.tsx`                 | Project editor, uploads, font preview/export, AI generation  |
| `src/routes/project/[id]/view/index.tsx`            | Public project detail view                                   |
| `src/routes/explore/index.tsx`                      | Public icon-set discovery                                    |
| `src/routes/favorites/index.tsx`                    | User favorites                                               |
| `src/routes/login/index.tsx` / `register/index.tsx` | Auth screens                                                 |
| `src/routes/settings/profile/index.tsx`             | Profile, tokens, webhooks, plan settings                     |
| `src/routes/layout.tsx`                             | Shared layout (`min-h-screen`)                               |
| `src/routes/demo/**`                                | Qwik scaffold demo pages — **not part of the product**       |

### `src/routes/api/` — API Endpoints

| Path                                       | Methods / Purpose                                   |
| ------------------------------------------ | --------------------------------------------------- |
| `api/auth/[...all]/index.ts`               | better-auth handler                                 |
| `api/projects/index.ts`                    | List/create projects; supports public search/cursor |
| `api/projects/[id]/index.ts`               | Get/update/delete project                           |
| `api/projects/[id]/icons/index.ts`         | List/upload icons                                   |
| `api/projects/[id]/icons/reorder/index.ts` | Persist icon sort order                             |
| `api/projects/[id]/favorite/index.ts`      | Favorite state GET/POST/DELETE                      |
| `api/projects/[id]/fork/index.ts`          | Fork a public project                               |
| `api/projects/[id]/publish/index.ts`       | Upload generated assets to R2 and expose asset URLs |
| `api/projects/[id]/assets/[file]/index.ts` | Serve published assets from R2                      |
| `api/projects/[id]/members/index.ts`       | Project member CRUD                                 |
| `api/projects/[id]/stats/index.ts`         | Increment views/downloads                           |
| `api/icons/[id]/index.ts`                  | Get/update/delete icon                              |
| `api/icons/[id]/svg/index.ts`              | Download raw SVG                                    |
| `api/github-import/index.ts`               | Browse GitHub directories and import selected SVGs  |
| `api/ai/generate/index.ts`                 | Generate SVG with configured AI provider            |
| `api/ai/modify/index.ts`                   | Modify existing SVG with AI                         |
| `api/tokens/index.ts`                      | API token create/list/delete                        |
| `api/webhooks/index.ts`                    | Webhook create/list/delete                          |

### `src/components/` — UI Components

| Component            | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `add-to-project`     | Add icons to another project                |
| `color-layer-editor` | COLRv0 color layer editing                  |
| `github-import`      | GitHub directory browser / SVG importer     |
| `highlight-text`     | Search query highlighting                   |
| `icon-detail`        | Icon metadata/detail panel                  |
| `project-members`    | Member invitation/role management           |
| `router-head`        | `<head>` metadata manager                   |
| `skeleton`           | Loading skeletons (project card, icon card) |
| `svg-color-editor`   | SVG fill color editing                      |
| `svg-editor`         | Inline SVG source editor                    |
| `svg-preview`        | Icon preview with size/color controls       |
| `theme-toggle`       | Light/dark mode switcher                    |
| `toast`              | Toast notification system                   |
| `user-menu`          | Authenticated user dropdown                 |

## Code Conventions

### TypeScript & Imports

- TypeScript strict mode is enabled.
- Path alias `~/*` maps to `src/*`.
- Keep shared app types in `src/lib/types.ts`; add library declarations in `src/types/`.
- Prefer dynamic imports inside loaders/actions when following existing route patterns.
- Preserve Qwik resumability constraints: avoid capturing non-serializable values in QRL closures unless wrapped with `noSerialize`.
- ESLint: `@typescript-eslint/no-explicit-any` is disabled — `any` is allowed in this codebase.

### Qwik Patterns

```typescript
export const useData = routeLoader$(async ({ platform, request }) => {
  const session = await getSessionFromRequest(platform, request);
  const db = getDB(platform);
  await initDB(db, platform);
  return { session };
});

export const useMutation = routeAction$(async (data, { platform, request }) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) return { success: false, error: "Not authenticated" };
  // mutate with Drizzle
});
```

### Data & Auth Rules

- For server-side DB reads/writes, call `getDB(platform)` and `initDB(db, platform)` unless local code has a clear reason not to.
- Use `getSessionFromRequest` for user session checks; use `resolveTokenUser` only for Bearer token API access.
- When adding auth-required routes, define behavior for unauthenticated users explicitly. Many UI flows support local anonymous mode.
- Keep D1-compatible values simple. `db.ts` wraps Date objects for better-auth, but app code generally stores ISO strings.
- Update `src/lib/schema.ts` and generate a `drizzle/` migration together for persisted schema changes.
- `initDB` contains fallback table/column creation for D1, but migrations are still the source of truth.

### Storage & SVG Rules

- Store uploaded SVGs with `uploadSVG(platform, projectId, iconName, content)` so keys and metadata stay consistent.
- Read SVG content from R2 via `getSVG` when `Icon.content` is unavailable.
- Sanitize user-visible icon names consistently: `name.replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-")`.
- Tags are stored as comma-separated strings in `icons.tags` (not JSON arrays). Reuse `parseTags()` / `formatTags()` from `src/lib/types.ts`.
- COLRv0 color layer data is stored as JSON in `icons.color_layers` (column type is `text` in SQLite).
- Keep font generation browser-compatible. `font-gen.ts` and `colr-font-gen.ts` are client-side critical paths.

### Styling & UI

- Tailwind CSS v4 + daisyUI. Custom classes use `brand-` or `clay-` prefix (e.g., `.brand-card`, `.clay-button`).
- Design system reference: `docs/design-system.md` and `src/global.css`.
- Key design constraints: 1px hairline borders (not shadow), ≤ 8px border-radius, Inter Tight + IBM Plex Mono, accent (rose) < 5% visual area, no spring/bounce animations.
- Use browser-only APIs inside `useVisibleTask$` or event handlers.
- Page `lang` is `zh-CN`; most UI strings are Chinese.

### File Naming

- Components live in feature folders: `src/components/name/name.tsx`.
- Route files use Qwik City conventions: `index.tsx`, `[param]/index.tsx`, API `index.ts`.
- Utility files use kebab-case where the project already does: `local-storage.ts`, `font-gen.ts`, `svg-color-extractor.ts`.

## Runtime Configuration

### Cloudflare Bindings (`wrangler.jsonc`)

- **Worker**: `name: "iconfont"`, `main: "./dist/_worker.js"`
- **Compatibility**: `compatibility_date: "2025-01-01"`, flags: `nodejs_compat`, `global_fetch_strictly_public`
- **Static assets**: `ASSET` binding → `./dist`
- **D1**: `DB` binding → `iconfont-db`
- **R2**: `BUCKET` binding → `iconfont-assets`

### Environment Variables

- `.dev.vars.example` documents local Wrangler variables; copy to `.dev.vars` for local runtime.
- Sensitive values should be stored with `wrangler secret put` instead of committed.
- **Auth required**: `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`
- **OAuth optional**: `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
- **Email optional**: `RESEND_API_KEY`, `EMAIL_FROM`
- **AI optional**: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `AI_MODEL`
- **GitHub import optional**: `GITHUB_TOKEN` (rate limit: 60/hr → 5000/hr)
- **Workers AI optional**: Uncomment `ai: { binding: "AI" }` in `wrangler.jsonc`

## Testing & QA

There is **no automated test framework** configured. Use these checks before handing off changes:

```bash
pnpm lint
pnpm build.types
pnpm build
pnpm fmt.check
```

### Manual Checks

- `pnpm dev` — anonymous local project/upload/export flows, UI interactions.
- `pnpm serve` (after `pnpm db:migrate`) — auth, D1/R2, token, webhook, publish, OAuth.
- Font work — manually test upload/edit/export for both monochrome and colored SVGs.
- Public/community features — test explore, project public view, favorite, fork, add-to-project.

### Known Gaps

- No unit tests for `font-gen.ts`, `colr-font-gen.ts`, SVG parsing, or color extraction.
- No integration tests for API route authorization and D1/R2 side effects.
- No E2E coverage for upload → edit → export → publish workflows.

## Security Considerations

- **Auth**: Sessions managed by better-auth with 7-day expiry. Trusted origins include `BETTER_AUTH_URL` + localhost dev ports (`5173`, `8788`).
- **API Tokens**: SHA-256 hashed before storage in `api_tokens.token_hash`. Plain tokens are only shown once at creation.
- **Webhooks**: Optional HMAC-SHA256 signature via `X-Webhook-Signature` header.
- **AI Base URL Validation**: `validateBaseUrl` enforces HTTPS, rejects auth info, rejects private hosts (`localhost`, `127.`, `10.`, `192.168.`, etc.).
- **SVG Sanitization**: `sanitizeSVG` strips `<script>`, `<style>`, event handlers, and `javascript:` hrefs from AI-generated SVGs.
- **Secrets**: Do not commit `.env`, `.dev.vars`, or `wrangler.jsonc` secrets. Use `wrangler secret put` for production.
- **Icon Name Sanitization**: `replace(/[^a-zA-Z0-9_-]/g, "-")` prevents path traversal in R2 object keys.

## Change Guidance for Agents

- Read nearby route/component code before introducing new patterns; this app mixes server-backed and local anonymous flows.
- Keep API responses JSON-shaped and status-coded consistently with existing routes.
- Do not remove localStorage fallback behavior unless the task explicitly changes anonymous mode.
- Avoid widening mock DB behavior unless needed; `MockExecutor` is a narrow dev helper, not a real SQL engine.
- When adding new persisted fields, update all of: `schema.ts`, migration SQL, API serialization, TypeScript interfaces, and relevant local fallback types.
- When changing generated asset formats, check download ZIP, standalone CSS, symbol SVG, demo HTML, and publish-to-R2 behavior.
- Do not commit secrets.
- `src/routes/demo/**` is Qwik scaffold — don't touch it unless explicitly asked.
- `figma-plugin/` is excluded from ESLint — don't refactor it from a normal dev task.
