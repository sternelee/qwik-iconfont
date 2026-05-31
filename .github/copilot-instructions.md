# Copilot Instructions for `qwik-iconfont`

## Build, test, and lint commands

```bash
pnpm dev            # local SSR dev server
pnpm start          # same as dev, but opens the browser
pnpm dev.debug      # dev server with Node inspector breakpoint

pnpm build          # full production build: type-check + client build + server build + lint
pnpm build.types    # TypeScript type-check only (tsc --incremental --noEmit)
pnpm build.client   # Vite client build
pnpm build.server   # SSR/worker build + post-build import fix

pnpm lint           # ESLint on src/**/*.ts*
pnpm fmt            # Prettier write
pnpm fmt.check      # Prettier check

pnpm preview        # production preview
pnpm preview:wrangler  # build then wrangler dev (tests auth flows)
pnpm serve          # wrangler dev against the built worker

pnpm db:generate         # drizzle-kit generate (creates migration files)
pnpm db:migrate          # apply migrations to local D1
pnpm db:migrate:remote   # apply migrations to remote D1
pnpm cf-typegen          # regenerate worker-configuration.d.ts from wrangler.jsonc
pnpm deploy              # wrangler deploy to Cloudflare Workers
```

There is **no automated test suite**: no `test` script and no `*.test.*` files. Verify changes with `pnpm build`, `pnpm lint`, and manual checks in `pnpm dev`.

## High-level architecture

**qwik-iconfont** is an open-source iconfont service: users upload SVGs, manage icon projects, and download generated font files (TTF, CSS, Symbol SVG). Stack: **Qwik City SSR** + **Cloudflare Workers (D1 + R2)** + **Vite**, styled with **Tailwind CSS v4** + **daisyUI** (custom `iconfont` theme).

### Dual-mode auth & data (critical)

The app branches on authentication state for **every** route and API handler:

- **Authenticated mode** — User is signed in via `better-auth` (email + password). Projects and icons live in **Cloudflare D1** (via Drizzle ORM), SVG files in **Cloudflare R2**. Real D1 bindings required; use `pnpm serve` or `pnpm preview:wrangler` to test.
- **Anonymous mode** — No auth session. All data (projects + icons) stored in **browser localStorage** via `src/lib/local-storage.ts`. No server persistence.

Pages and API routes call `getSessionFromRequest()` from `src/lib/session.ts` to branch:

```typescript
const session = await getSessionFromRequest(requestEvent);
if (session) {
  // D1 + R2 path
} else {
  // localStorage path (client-side only)
}
```

Auth stack:
- `src/lib/auth.ts` — `betterAuth` instance backed by D1 via Drizzle adapter.
- `src/lib/auth-client.ts` — Thin fetch wrapper for sign-up, sign-in, sign-out, get-session.
- `src/lib/session.ts` — Server-side `getSessionFromRequest()` helper.
- `src/routes/api/auth/[...all]/index.ts` — Catch-all proxy for `/api/auth/*`.
- `src/lib/api-auth.ts` — `resolveTokenUser()` for Bearer token auth (API access).

### Backend abstraction & local dev fallback

`src/lib/db.ts` and `src/lib/storage.ts` wrap Cloudflare D1 and R2 respectively. In local dev (no bindings), they fall back to in-memory mocks (`sqlite-proxy` + `MockExecutor`, `MockBucket`). `initDB()` also auto-creates tables when migrations haven't run.

The real product routes are `src/routes/index.tsx`, `src/routes/project/[id]/index.tsx`, and `src/routes/api/**`. The `src/routes/demo/**` routes are Qwik starter examples — not part of the product.

### SVG upload & icon storage

Upload path: project page → `POST /api/projects/:id/icons` (multipart) → sanitize name → store SVG at `projects/{projectId}/{iconName}.svg` in R2 → write metadata to D1.

The app keeps both `icons.svg_path` (R2 key) and `icons.content` (raw SVG cached in DB) so previews and `/api/icons/[id]/svg` serve from DB before falling back to R2.

### Font generation (client-side)

`src/lib/font-gen.ts` is the sole font generation entry point: flattens SVG shapes/transforms → scales to font coordinate space → assembles SVG font XML → converts to TTF via `svg2ttf`. Also generates CSS (`@font-face` + per-icon rules), Symbol SVG sprite, and demo HTML. `jszip` packages downloads.

### Additional lib modules

- `src/lib/quota.ts` — Per-plan limits (`free`: 10 projects / 200 icons, `pro`: unlimited). Call `getQuota(plan)` before create operations.
- `src/lib/github-registry.ts` — Curated list of open-source icon libraries on GitHub with metadata for browsing/importing.
- `src/lib/webhook.ts` — Project-level webhook dispatch (`triggerWebhooks`).
- `src/lib/schema.ts` — Drizzle schema: `user`, `session`, `account`, `verification` (better-auth), `projects`, `icons`, `apiTokens`, `webhooks`.

### Figma plugin

`figma-plugin/` is a standalone Figma plugin workspace (separate from the main app build).

## Key conventions

- **Preserve the local-dev fallback.** New server-side features must go through `getDB()/initDB()` and `getBucket()/uploadSVG()/getSVG()/deleteSVG()` — never touch `platform.env.DB` or `platform.env.BUCKET` directly.
- **Auth branching is mandatory.** Every route/API handler that reads or writes data must check `getSessionFromRequest()` and handle both authenticated (D1/R2) and anonymous (localStorage) paths.
- **Keep icon naming aligned.** Icon names are sanitized: `replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-")`. The sanitized name is persisted and used in R2 keys (`projects/{projectId}/{iconName}.svg`).
- **`src/lib/font-gen.ts` is the single source of truth** for asset generation. Don't duplicate TTF/CSS/symbol/demo logic in routes or components.
- **Tags are comma-separated strings** in `icons.tags`. Use `parseTags()` / `formatTags()` from `src/lib/types.ts`.
- **Use `~/*` path alias** for all imports from `src/*`.
- **File naming:** components use `kebab-case.component.tsx`, utilities use `kebab-case.ts`, API routes use `index.ts`.
- **ESLint note:** `@typescript-eslint/no-explicit-any` is disabled — `any` is allowed.
- **Styling:** Use daisyUI component classes (`btn`, `card`, `modal`, `navbar`, etc.). Animation utilities are in `src/global.css`. See `docs/design-system.md` for full visual guidelines.
- Avoid changing `src/routes/demo/**` unless the task explicitly targets that code.
