# Copilot Instructions for `qwik-iconfont`

## Build, test, and lint commands

```bash
pnpm dev            # local SSR dev server
pnpm start          # same as dev, but opens the browser

pnpm build          # full production build: type-check + client build + server build + lint
pnpm build.types    # TypeScript only
pnpm build.client   # Vite client build
pnpm build.server   # SSR/worker build + post-build import fix

pnpm lint           # ESLint on src/**/*.ts*
pnpm fmt            # Prettier write
pnpm fmt.check      # Prettier check

pnpm preview        # production preview
pnpm preview:wrangler
pnpm serve          # wrangler dev against the built worker
```

There is **no automated test suite** in this repository yet: no `test` script in `package.json`, and no `*.test.*` / `*.spec.*` files. There is also no single-test command today; use `pnpm build`, `pnpm lint`, and targeted manual checks in `pnpm dev`.

## High-level architecture

- The real product lives in `src/routes/index.tsx`, `src/routes/project/[id]/index.tsx`, and `src/routes/api/**`. The `src/routes/demo/**` routes are Qwik starter examples, not part of the iconfont product.
- Page data and in-page mutations use Qwik City primitives (`routeLoader$`, `routeAction$`), while external/async flows use REST-style handlers under `src/routes/api/**`.
- `src/lib/db.ts` and `src/lib/storage.ts` provide the shared backend abstraction layer. In production they bind to Cloudflare D1 and R2 through `platform.env`; in local development they fall back to in-memory mocks (`sqlite-proxy` + `MockExecutor`, `MockBucket`) so the app runs without Cloudflare bindings.
- The upload path is split across page + API + storage layers: the project page uploads raw SVG text to `/api/projects/:id/icons`, the handler sanitizes the icon name, stores the SVG at `projects/{projectId}/{iconName}.svg`, and writes icon metadata into D1.
- The app deliberately keeps both `icons.svg_path` and `icons.content`: SVG files are stored in R2, but the raw SVG text is also cached in the database so UI previews and `/api/icons/[id]/svg` can serve from DB content before falling back to bucket reads.
- Font generation is client-side. `src/lib/font-gen.ts` flattens SVG shapes/transforms into path data, converts an SVG font to TTF with `svg2ttf`, and also generates CSS, symbol sprites, and demo HTML. The project page imports that module directly for preview, download, and zip packaging.

## Key conventions

- Preserve the local-dev fallback path. New server-side features should go through `getDB()/initDB()` and `getBucket()/uploadSVG()/getSVG()/deleteSVG()` instead of touching `platform.env.DB` or `platform.env.BUCKET` directly.
- Keep icon naming and storage keys aligned. Icon names are sanitized with `replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-")`, and the sanitized name is what gets persisted and used in R2 object keys.
- Treat `src/lib/font-gen.ts` as the single source of truth for icon asset generation. If a task changes how TTF/CSS/symbol/demo output works, update the shared generator functions instead of duplicating logic in routes or components.
- Tags are stored as a comma-separated string in `icons.tags`. Reuse `parseTags()` / `formatTags()` from `src/lib/types.ts` when touching shared tag behavior.
- Use the `~/*` path alias for imports from `src/*`.
- Repo-wide lint/build cover the scaffold demo routes too. Avoid changing `src/routes/demo/**` unless the task explicitly targets starter/demo code.
