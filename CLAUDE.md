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

This is an **open-source iconfont service** built with **Qwik City** + **Vite**, styled with **Tailwind CSS** + **daisyUI**.

### Infrastructure

- **Cloudflare D1** (`wrangler.jsonc`) — SQLite database for projects and icons metadata.
- **Cloudflare R2** (`wrangler.jsonc`) — Object storage for SVG files.
- **Local dev fallback** — `src/lib/db.ts` and `src/lib/storage.ts` provide in-memory mocks when Cloudflare bindings are unavailable.

### Data Model

- `projects` — Iconfont projects (name, font_family, prefix, description).
- `icons` — SVG icons within a project (name, unicode, svg_path, view_box, content).

### Pages

- `src/routes/index.tsx` — Project list with create-project modal.
- `src/routes/project/[id]/index.tsx` — Project detail: icon grid, upload, batch ops, edit, code generation, font download.

### API Routes

- `src/routes/api/projects/index.ts` — `GET` list, `POST` create.
- `src/routes/api/projects/[id]/index.ts` — `GET` detail, `PUT` update, `DELETE` remove.
- `src/routes/api/projects/[id]/icons/index.ts` — `GET` list icons, `POST` upload icon (multipart/form-data).
- `src/routes/api/icons/[id]/index.ts` — `GET`, `PUT`, `DELETE` single icon.
- `src/routes/api/icons/[id]/svg/index.ts` — `GET` raw SVG content.

### Font Generation

- `src/lib/font-gen.ts` — Uses `opentype.js` to generate TTF fonts from SVG paths.
- Generates CSS, Symbol SVG sprite, and demo HTML.
- `jszip` packages downloads into `.zip` files.

### Styling

- Global styles: `src/global.css` (Tailwind CSS v4 + daisyUI).
- UI uses daisyUI components: `btn`, `card`, `modal`, `navbar`, `tabs`, `form-control`, etc.

### Path Aliases

`~/*` resolves to `./src/*` (configured in `tsconfig.json`).

### Tooling

- **Package manager:** pnpm (monorepo config in `pnpm-workspace.yaml`).
- **TypeScript:** Target ES2020, module ES2022, JSX via `@builder.io/qwik`.
- **ESLint:** Uses `eslint-plugin-qwik` + `typescript-eslint`. `@typescript-eslint/no-explicit-any` is disabled.
- **Deployment:** `wrangler.jsonc` configured for Cloudflare Workers with D1 and R2 bindings.
