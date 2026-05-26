# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Start the Vite dev server with SSR.
- `pnpm start` — Same as `dev` but opens the browser.
- `pnpm build` — Production build (runs client + server + type check).
- `pnpm preview` — Production build + local preview server.
- `pnpm lint` — Lint `src/**/*.ts*` with ESLint.
- `pnpm fmt` — Format with Prettier.
- `pnpm fmt.check` — Check formatting.
- `pnpm build.types` — Type-check only (`tsc --incremental --noEmit`).
- `pnpm qwik add` — Add Qwik integrations (adapters, etc.).

## Architecture

This is a **Qwik City** app (Qwik meta-framework) built with **Vite**.

### Entry Points

- `src/entry.ssr.tsx` — SSR render entry (used by dev, preview, and production builds).
- `src/entry.preview.tsx` — Preview server entry.
- `src/entry.dev.tsx` — Vite dev server entry.

### Routing

Qwik City uses directory-based routing under `src/routes/`.

- `src/routes/layout.tsx` — Root layout (wraps all pages). Exports `useServerTimeLoader` routeLoader.
- `src/routes/index.tsx` — Home page.
- `src/routes/demo/flower/` and `src/routes/demo/todolist/` — Demo pages.
- `index.ts` files in routes become API endpoints.

### Components

- `src/components/router-head/router-head.tsx` — Renders `<head>` meta, links, styles, and scripts from route `head` exports.
- `src/root.tsx` — Root component wrapping the app in `<QwikCityProvider>`.

### Styling

- Global styles: `src/global.css` (imported in `root.tsx`).
- Route/layout styles: imported with `?inline` and applied via `useStyles$()`.
- Component styles: CSS modules (e.g., `counter.module.css`) with TypeScript plugin support.

### Path Aliases

`~/*` resolves to `./src/*` (configured in `tsconfig.json`).

### Tooling

- **Package manager:** pnpm (monorepo config in `pnpm-workspace.yaml`).
- **TypeScript:** Target ES2020, module ES2022, JSX via `@builder.io/qwik`.
- **ESLint:** Uses `eslint-plugin-qwik` + `typescript-eslint`. `@typescript-eslint/no-explicit-any` is disabled.
- **Deployment:** `wrangler.jsonc` is present for Cloudflare Workers; run `pnpm qwik add` to configure an adapter.
