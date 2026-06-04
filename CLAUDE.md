# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Start the Vite dev server with SSR.
- `pnpm start` — Same as `dev` but opens the browser.
- `pnpm dev.debug` — Start dev server with Node inspector breakpoint.
- `pnpm build` — Production build (type-check + client + server + lint).
- `pnpm build.types` — Type-check only (`tsc --incremental --noEmit`).
- `pnpm preview` — Production build + local preview server.
- `pnpm preview:wrangler` — Build then run `wrangler dev` against the built worker.
- `pnpm serve` — Run `wrangler dev` (requires Cloudflare bindings).
- `pnpm lint` — Lint `src/**/*.ts*` with ESLint.
- `pnpm fmt` — Format with Prettier.
- `pnpm fmt.check` — Check formatting.
- `pnpm db:generate` — Generate Drizzle migrations (`drizzle-kit generate`).
- `pnpm db:migrate` — Apply D1 migrations locally.
- `pnpm db:migrate:remote` — Apply D1 migrations to remote DB.
- `pnpm cf-typegen` — Generate Cloudflare Workers types from `wrangler.jsonc`.
- `pnpm deploy` — Deploy to Cloudflare Workers (`wrangler deploy`).
- `pnpm qwik add` — Add Qwik integrations (adapters, etc.).

There is **no test suite** in this repository — no `test` script and no `*.test.*` files. Verify changes with `pnpm build`, `pnpm lint`, and manual checks in `pnpm dev`.

## Architecture

This is an **open-source iconfont service** built with **Qwik City** + **Vite**, styled with **Tailwind CSS v4** + **daisyUI**.

### Dual-Mode Auth & Data

The app supports two mutually exclusive data modes:

1. **Authenticated mode** — Users sign up/in via `better-auth` (email + password). Data lives in **Cloudflare D1** and SVG files in **Cloudflare R2**. Auth requires real D1 bindings; use `pnpm serve` or `pnpm preview:wrangler` to test auth flows.
2. **Anonymous mode** — When no auth session exists, all data (projects + icons) is stored in **browser localStorage** via `src/lib/local-storage.ts`. No server persistence.

Pages and API routes branch on `getSessionFromRequest()`:

- Authenticated → query D1 via Drizzle ORM, store SVGs in R2.
- Anonymous → read/write `localStorage` on the client side.

Auth stack:

- `src/lib/auth.ts` — Creates a `betterAuth` instance backed by D1 via Drizzle adapter.
- `src/lib/auth-client.ts` — Thin fetch wrapper for sign-up, sign-in, sign-out, get-session.
- `src/lib/session.ts` — Server-side `getSessionFromRequest()` helper for route loaders/actions.
- `src/routes/api/auth/[...all]/index.ts` — Catch-all proxy that delegates `/api/auth/*` to better-auth's handler.

### Infrastructure

- **Cloudflare D1** (`wrangler.jsonc`) — SQLite database. Schema defined in `src/lib/schema.ts` via Drizzle ORM. Tables: `user`, `session`, `account`, `verification` (better-auth), `projects`, `icons` (app).
- **Cloudflare R2** (`wrangler.jsonc`) — Object storage for SVG files.
- **Local dev fallback** — `src/lib/db.ts` and `src/lib/storage.ts` provide in-memory mocks (`MockExecutor`, `MockBucket`) when Cloudflare bindings are unavailable. `initDB()` also auto-creates tables on D1 as a fallback when migrations haven't been applied.

### Data Model

- `projects` — Iconfont projects (name, font_family, prefix, description, user_id). `user_id` is null for anonymous projects.
- `icons` — SVG icons within a project (name, unicode, svg_path, view_box, content, tags, width, height).

The app deliberately keeps both `icons.svg_path` (R2 key) and `icons.content` (raw SVG text cached in DB) so UI previews and `/api/icons/[id]/svg` can serve from DB before falling back to bucket reads.

### Pages

- `src/routes/index.tsx` — Project list with create-project modal. Also handles login/register UI.
- `src/routes/project/[id]/index.tsx` — Project detail: icon grid, upload, batch ops, edit, code generation, font download. Loads via `routeLoader$` that branches on auth session.
- `src/routes/demo/**` — Qwik starter example routes, **not part of the iconfont product**.

### API Routes

- `src/routes/api/projects/index.ts` — `GET` list (auth-required), `POST` create.
- `src/routes/api/projects/[id]/index.ts` — `GET` detail, `PUT` update, `DELETE` remove.
- `src/routes/api/projects/[id]/icons/index.ts` — `GET` list icons, `POST` upload icon (multipart/form-data).
- `src/routes/api/icons/[id]/index.ts` — `GET`, `PUT`, `DELETE` single icon.
- `src/routes/api/icons/[id]/svg/index.ts` — `GET` raw SVG content.
- `src/routes/api/auth/[...all]/index.ts` — better-auth catch-all.

### Font Generation

- `src/lib/font-gen.ts` — Single source of truth for icon asset generation.
- Pipeline: extract path data from SVG (flatten shapes/transforms) → scale & flip to font coordinate space → assemble SVG font XML → convert to TTF via `svg2ttf`.
- Also generates CSS (`@font-face` + per-icon rules), Symbol SVG sprite, and demo HTML.
- `jszip` packages downloads into `.zip` files.

### Styling

- Global styles: `src/global.css` (Tailwind CSS v4 + daisyUI with a custom `iconfont` theme).
- UI uses daisyUI components: `btn`, `card`, `modal`, `navbar`, `tabs`, `form-control`, etc.
- Animation utilities defined in `global.css` (fade-in, slide-up, modal-in, toast-in, etc.).
- **Design system**: See `docs/design-system.md` for full visual guidelines — colors, typography, claymorphism specs, layout, animations.

### Path Aliases

`~/*` resolves to `./src/*` (configured in `tsconfig.json`).

### Tooling

- **Package manager:** pnpm (monorepo config in `pnpm-workspace.yaml`).
- **TypeScript:** Target ES2020, module ES2022, JSX via `@builder.io/qwik`.
- **ESLint:** Uses `eslint-plugin-qwik` + `typescript-eslint`. `@typescript-eslint/no-explicit-any` is disabled.
- **Deployment:** `wrangler.jsonc` configured for Cloudflare Workers with D1 and R2 bindings.

## Key Conventions

- **Preserve the local-dev fallback path.** New server-side features should go through `getDB()/initDB()` and `getBucket()/uploadSVG()/getSVG()/deleteSVG()` instead of touching `platform.env.DB` or `platform.env.BUCKET` directly.
- **Keep icon naming and storage keys aligned.** Icon names are sanitized with `replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-")`, and the sanitized name is what gets persisted and used in R2 object keys (`projects/{projectId}/{iconName}.svg`).
- **Treat `src/lib/font-gen.ts` as the single source of truth** for icon asset generation. If a task changes how TTF/CSS/symbol/demo output works, update the shared generator functions instead of duplicating logic in routes or components.
- **Tags are stored as a comma-separated string** in `icons.tags`. Reuse `parseTags()` / `formatTags()` from `src/lib/types.ts` when touching tag behavior.
- **Use the `~/*` path alias** for imports from `src/*`.
- **Repo-wide lint/build cover the scaffold demo routes too.** Avoid changing `src/routes/demo/**` unless the task explicitly targets starter/demo code.
