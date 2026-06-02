# Repository Guidelines

> AI assistant reference for the `qwik-iconfont` project.

## Project Overview

`qwik-iconfont` is an open source SVG icon-set manager and icon-font generator. Users can create icon projects, upload or import SVGs, edit icons and colors, generate font assets, publish public icon sets, fork/favorite community projects, and use SaaS features such as authentication, quotas, API tokens, webhooks, and collaboration.

**Stack**: Qwik City SSR + Vite + Cloudflare Workers + D1 + R2 + Drizzle ORM + Tailwind CSS v4/daisyUI.

## Architecture & Data Flow

### Core Flow

```text
Upload/import/generate SVG
  -> Store SVG content in R2 or localStorage/mock storage
  -> Persist project/icon metadata in D1 or mock DB
  -> Client-side font generation with svg2ttf/COLRv0 helpers
  -> Download ZIP/TTF/CSS/Symbol SVG/Demo HTML or publish assets to R2
```

### Main Runtime Modes

- `pnpm dev` runs Vite SSR on port `5173`; it uses in-memory mock DB/R2 and anonymous `localStorage` flows. Auth-dependent features are limited.
- `pnpm serve` runs Wrangler dev on port `8788`; use this for D1/R2, better-auth, OAuth, API tokens, and full Workers runtime behavior.
- Production builds target Cloudflare Workers via `adapters/cloudflare-workers/vite.config.ts` and `src/entry.cloudflare-pages.tsx`.

### Repo-specific Gotchas

- **`src/routes/demo/**` is Qwik scaffold, not part of the product.** Don't touch it unless the task explicitly targets starter/demo code. Repo-wide lint/build still covers it.
- **`figma-plugin/` is a separate plugin and is excluded from ESLint** (`eslint.config.js`). Don't refactor it from a normal dev task.
- **`.github/` only contains `copilot-instructions.md`** — there is no CI workflow. Don't look for one; verify with `pnpm lint` + `pnpm build.types` + `pnpm build` + manual `pnpm dev`/`pnpm serve` instead.
- **`pnpm build.server` runs `scripts/fix-worker-import.mjs`** as a post-build step. It patches `dist/_worker.js` so `import "server/entry.cloudflare-pages"` becomes a relative import that wrangler can resolve. If a build step fails or `dist/_worker.js` looks wrong post-build, this script is the suspect.
- **`pnpm-workspace.yaml` is NOT a monorepo manifest.** It only declares `allowBuilds` for native modules. Don't add a `packages` entry expecting workspaces.
- **`tsconfig.json` is typecheck-only:** `noEmit: true` + `outDir: "tmp"`. `pnpm build.types` never writes production JS — it's pure `tsc --incremental --noEmit`.

### Key Patterns

- Qwik City file-based routing with `routeLoader$` and `routeAction$` for page data and mutations.
- API routes export Qwik City `RequestHandler`s (`onGet`, `onPost`, `onPut`, `onDelete`).
- Drizzle schema lives in `src/lib/schema.ts`; migrations live in `drizzle/`.
- Storage is accessed through `src/lib/storage.ts`; use `getBucket(platform)`, `uploadSVG`, `getSVG`, and `deleteSVG`.
- Database access goes through `getDB(platform)` and usually `await initDB(db, platform)` before queries.
- Auth is provided by better-auth in `src/lib/auth.ts`; server code usually reads sessions with `getSessionFromRequest(platform, request)`.
- Unauthenticated users use browser `localStorage` helpers in `src/lib/local-storage.ts`.
- Client-heavy workflows use Qwik signals/stores and `useVisibleTask$` where browser APIs are required.

## Key Directories

| Directory         | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `src/lib/`        | DB, auth, storage, types, local storage, AI, font generation   |
| `src/routes/`     | Qwik City pages and API endpoints                              |
| `src/components/` | Reusable UI components and feature widgets                     |
| `src/types/`      | External/library type declarations                             |
| `drizzle/`        | D1 migration SQL and Drizzle metadata                          |
| `adapters/`       | Cloudflare Workers build adapter config                        |
| `figma-plugin/`   | Figma plugin manifest, UI, and plugin code                     |
| `docs/`           | Project documentation such as the design system                |
| `public/`         | Static assets including fonts, icons, manifest, and robots.txt |

### Entry Points

- `src/root.tsx` - Qwik root document.
- `src/entry.ssr.tsx` - SSR renderer.
- `src/entry.dev.tsx` - Vite dev entry.
- `src/entry.preview.tsx` - Node preview server entry.
- `src/entry.cloudflare-pages.tsx` - Cloudflare Worker request entry.

## Important Files

### Core Library

| File                             | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `src/lib/schema.ts`              | Drizzle schema. better-auth tables: `user`, `session`, `account`, `verification`. App tables: `projects`, `icons`, `favorites`, `api_tokens`, `project_members`, `webhooks`. |
| `src/lib/db.ts`                  | D1 adapter, D1 Date binding wrapper, mock SQLite proxy, init fallback |
| `src/lib/storage.ts`             | R2 bucket abstraction and in-memory `MockBucket`                      |
| `src/lib/auth.ts`                | better-auth configuration and OAuth providers                         |
| `src/lib/auth-client.ts`         | Thin fetch wrapper around better-auth for sign-up/in/out, get-session |
| `src/lib/session.ts`             | Server-side session lookup for loaders/actions/routes                 |
| `src/lib/api-auth.ts`            | Bearer token extraction and SHA-256 token user resolution             |
| `src/lib/quota.ts`               | Free/Pro quota rules                                                  |
| `src/lib/font-gen.ts`            | Monochrome SVG font, CSS, Symbol SVG, and demo HTML generation        |
| `src/lib/colr-font-gen.ts`       | COLRv0/CPAL colored font generation                                   |
| `src/lib/svg-color-extractor.ts` | Color layer extraction for multi-color SVG editing                    |
| `src/lib/ai.ts`                  | AI SVG generation/modify provider helpers                             |
| `src/lib/ai-settings.ts`         | Client-side AI provider/API-key settings                              |
| `src/lib/local-storage.ts`       | Anonymous local project/icon persistence                              |
| `src/lib/local-migration.ts`     | One-way import of anonymous localStorage projects into a user account |
| `src/lib/github-registry.ts`     | GitHub tree fetch/cache/import helpers                                |
| `src/lib/webhook.ts`             | Webhook dispatch helpers                                              |
| `src/lib/types.ts`               | App interfaces, `parseTags`/`formatTags`, and SVG helpers              |

### Pages

| Path                                                | Purpose                                       |
| --------------------------------------------------- | --------------------------------------------- |
| `src/routes/index.tsx`                              | Home dashboard, local/server projects, import |
| `src/routes/project/[id]/index.tsx`                 | Project editor, uploads, font preview/export  |
| `src/routes/project/[id]/view/index.tsx`            | Public project detail view                    |
| `src/routes/explore/index.tsx`                      | Public icon-set discovery                     |
| `src/routes/favorites/index.tsx`                    | User favorites                                |
| `src/routes/login/index.tsx` / `register/index.tsx` | Auth screens                                  |
| `src/routes/settings/profile/index.tsx`             | Profile, tokens, webhooks, plan settings      |
| `src/routes/layout.tsx`                             | Shared layout                                 |

### API Routes

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

## Development Commands

```bash
pnpm dev              # Vite SSR dev server (mock DB/R2, anonymous local mode)
pnpm serve            # Wrangler dev server (D1/R2/auth/full Workers runtime)
pnpm build            # Production build
pnpm build.client     # Client build
pnpm build.server     # Worker SSR build + import patch
pnpm build.preview    # Preview SSR build
pnpm preview          # Build preview then open Vite preview
pnpm preview:wrangler # Build then run wrangler dev
pnpm build.types      # TypeScript check
pnpm lint             # ESLint over src/**/*.ts*
pnpm fmt              # Prettier write
pnpm fmt.check        # Prettier check
pnpm db:generate      # Generate Drizzle migration after schema changes
pnpm db:migrate       # Apply D1 migrations locally
pnpm db:migrate:remote # Apply D1 migrations remotely
pnpm cf-typegen       # Generate Cloudflare binding types
pnpm deploy           # wrangler deploy
```

## Code Conventions

### TypeScript and Imports

- TypeScript strict mode is enabled.
- Path alias `~/*` maps to `src/*`.
- Keep shared app types in `src/lib/types.ts`; add library declarations in `src/types/` when needed.
- Prefer dynamic imports inside loaders/actions when following existing route patterns.
- Preserve Qwik resumability constraints: avoid capturing non-serializable values in QRL closures unless wrapped with `noSerialize`.

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

### Data and Auth Rules

- For server-side DB reads/writes, call `getDB(platform)` and `initDB(db, platform)` unless the local code has a clear reason not to.
- Use `getSessionFromRequest` for user session checks; use `resolveTokenUser` only for Bearer token API access.
- When adding auth-required routes, define behavior for unauthenticated users explicitly. Many UI flows support local anonymous mode.
- Keep D1-compatible values simple. `db.ts` wraps Date objects for better-auth, but app code generally stores ISO strings.
- Update `src/lib/schema.ts` and generate a `drizzle/` migration together for persisted schema changes.
- Be aware that `initDB` contains fallback table/column creation for D1, but migrations are still the source of record.

### Storage and SVG Rules

- Store uploaded SVGs with `uploadSVG(platform, projectId, iconName, content)` so keys and metadata stay consistent.
- Read SVG content from R2 via `getSVG` when `Icon.content` is unavailable.
- Sanitize user-visible icon names the same way nearby code does: `name.replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-")`. The sanitized name is what gets persisted and used in R2 object keys (`projects/{projectId}/{iconName}.svg`).
- Tags are stored as a comma-separated string in `icons.tags` (not a JSON array). Reuse `parseTags()` / `formatTags()` from `src/lib/types.ts` for any tag I/O.
- COLRv0 color layer data is stored as JSON in `icons.color_layers` (column is `text` in SQLite). Coordinate through `src/lib/svg-color-extractor.ts` and `src/lib/colr-font-gen.ts`.
- Keep font generation browser-compatible. `font-gen.ts` and `colr-font-gen.ts` are client-side critical paths.

### Styling and UI

- Existing UI uses Tailwind CSS v4 and daisyUI, with several Chinese UI strings.
- Keep pages work-focused and consistent with current components (`ToastContainer`, `Skeleton*`, `ThemeToggle`, `UserMenu`, `SvgPreview`, editors).
- Use browser-only APIs inside `useVisibleTask$` or event handlers.
- `src/global.css` and `docs/design-system.md` are the main design references.

### File Naming

- Components live in feature folders, usually `src/components/name/name.tsx`.
- Route files use Qwik City conventions: `index.tsx`, `[param]/index.tsx`, and API `index.ts`.
- Utility files use kebab-case where the project already does (`local-storage.ts`, `font-gen.ts`, `svg-color-extractor.ts`).

## Runtime Configuration

### Cloudflare Bindings

`wrangler.jsonc` configures:

- Worker name/main and compatibility flags.
- Static assets directory (`./dist`).
- D1 binding `DB`.
- R2 binding `BUCKET`.
- Environment variables for auth, OAuth, email, app URL, and AI providers.

### Environment Variables

- `.dev.vars.example` documents local Wrangler variables; copy to `.dev.vars` for full local runtime.
- Sensitive values should be stored with `wrangler secret put` instead of committed in config.
- Auth requires `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`.
- OAuth uses `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
- Email welcome flow uses `RESEND_API_KEY` and optional `EMAIL_FROM`.

## Testing and QA

There is no dedicated test framework configured. Use these checks before handing off risky changes:

```bash
pnpm lint
pnpm build.types
pnpm build
pnpm fmt.check
```

Manual checks:

- `pnpm dev` for anonymous local project/upload/export flows.
- `pnpm serve` after `pnpm db:migrate` for auth, D1/R2, token, webhook, publish, and OAuth-adjacent behavior.
- For font work, manually test upload/edit/export for both monochrome and colored SVGs.
- For public/community features, test explore, project public view, favorite, fork, and add-to-project flows.

Known gaps:

- No unit tests for `font-gen.ts`, `colr-font-gen.ts`, SVG parsing, or color extraction.
- No integration tests for API route authorization and D1/R2 side effects.
- No E2E coverage for upload -> edit -> export -> publish workflows.

## Change Guidance for Agents

- Read nearby route/component code before introducing new patterns; this app mixes server-backed and local anonymous flows.
- Keep API responses JSON-shaped and status-coded consistently with existing routes.
- Do not remove localStorage fallback behavior unless the task explicitly changes anonymous mode.
- Avoid widening mock DB behavior unless needed for the current feature; `MockExecutor` is a narrow dev helper, not a real SQL engine.
- When adding new persisted fields, update all of: `schema.ts`, migration SQL, API serialization, TypeScript interfaces, and relevant local fallback types if applicable.
- When changing generated asset formats, check download ZIP, standalone CSS, symbol SVG, demo HTML, and publish-to-R2 behavior.
- Do not commit secrets from `.env`, `.dev.vars`, or `wrangler.jsonc`.
