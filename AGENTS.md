# Repository Guidelines

> AI assistant reference for qwik-iconfont project

## Project Overview

**qwik-iconfont** is a web application for generating custom icon fonts from SVG uploads. Users create projects, upload SVG icons, and download generated font files (TTF, CSS, SVG) for use in web projects.

**Stack**: Qwik City SSR + Cloudflare Workers (D1 + R2) + Vite

---

## Architecture & Data Flow

### Core Flow

```
User Upload SVG → Store in R2 → Client-side TTF generation (svg2ttf) → Download fonts
```

### Key Architectural Patterns

1. **Qwik City SSR** — File-based routing with `routeLoader$` for server data, `routeAction$` for mutations
2. **Cloudflare Workers** — Serverless deployment with Workers adapter
3. **Hybrid Storage** — R2 for production, in-memory `MockBucket` for local dev
4. **Hybrid DB** — D1 (SQLite) for production, in-memory mock for local dev
5. **Client-side Font Gen** — TTF generation happens in browser using `svg2ttf`

### State Management

- **Qwik Signals** (`useSignal`, `useStore`) for reactive UI state
- **routeLoader$** for server-to-client data fetching
- **routeAction$** for form mutations with validation
- **No global state library** — component-level signals only

---

## Key Directories

| Directory         | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| `src/lib/`        | Core business logic (DB, storage, types, font generation) |
| `src/routes/`     | Qwik City pages and API endpoints                         |
| `src/components/` | Reusable UI components                                    |
| `src/types/`      | TypeScript type definitions                               |
| `adapters/`       | Platform-specific build adapters                          |
| `public/`         | Static assets (fonts, icons)                              |

### Entry Points

- `src/entry.ssr.tsx` — SSR rendering (stream-based)
- `src/entry.cloudflare-pages.tsx` — Cloudflare Pages adapter
- `src/entry.preview.tsx` — Node.js preview server
- `src/entry.dev.tsx` — Client-side dev with HMR

---

## Development Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm build.client # Client-only build
pnpm build.server # Server build (SSR)
pnpm build.preview # Preview build
pnpm preview      # Preview production build
pnpm serve        # Serve production build
pnpm lint         # ESLint check
pnpm fmt          # Format code (Prettier + Tailwind)
pnpm fmt.check    # Check formatting without changes
```

---

## Code Conventions

### TypeScript

- **Strict mode** enabled in tsconfig.json
- **Path aliases**: `~/*` maps to `src/*`
- Define types in `src/lib/types.ts` and `src/types/`

### Qwik Patterns

```typescript
// Server data loading
export const useDataLoader = routeLoader$(async (requestEvent) => {
  return await db.query.projects();
});

// Form actions with validation
export const useMyAction = routeAction$(async (data, requestEvent) => {
  // validation + mutation
}, zodSchema);

// Reactive state
const count = useSignal(0);
const store = useStore({ items: [] });
```

### File Naming

- Components: `kebab-case.component.tsx`
- Utilities: `kebab-case.ts`
- Route files: `index.tsx`, `[param].tsx`
- API routes: `index.ts` (GET/POST), `[id]/index.ts` (per-resource)

### Error Handling

- API routes return typed responses with error status
- Form actions use Zod validation schemas
- Storage/DB layer has try-catch with meaningful errors

---

## Important Files

### Core Library (`src/lib/`)

| File          | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `db.ts`       | Database layer — D1 adapter + mock executor for dev |
| `schema.ts`   | Drizzle schema for projects/icons tables            |
| `storage.ts`  | R2 storage with MockBucket fallback                 |
| `font-gen.ts` | SVG → TTF pipeline (svg2ttf, CSS generation)        |
| `types.ts`    | TypeScript interfaces (Project, Icon, etc.)         |

### API Routes (`src/routes/api/`)

| Path                           | Methods                   |
| ------------------------------ | ------------------------- |
| `projects/index.ts`            | GET (list), POST (create) |
| `projects/[id]/index.ts`       | GET, PUT, DELETE          |
| `projects/[id]/icons/index.ts` | GET, POST                 |
| `icons/[id]/index.ts`          | GET, PUT, DELETE          |
| `icons/[id]/svg/index.ts`      | GET (download SVG)        |

### Pages (`src/routes/`)

| Path                     | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `index.tsx`              | Projects list, create/delete project          |
| `project/[id]/index.tsx` | Project detail, icon management, font preview |
| `layout.tsx`             | Shared route layout                           |

---

## Runtime & Tooling

| Tool                | Version/Config                         |
| ------------------- | -------------------------------------- |
| **Runtime**         | Bun (primary) / Node.js (fallback)     |
| **Package Manager** | pnpm                                   |
| **Build**           | Vite + Qwik plugin                     |
| **Database**        | Cloudflare D1 (SQLite via Drizzle ORM) |
| **Storage**         | Cloudflare R2 + MockBucket (dev)       |
| **Deployment**      | Cloudflare Pages Workers               |
| **Linting**         | ESLint (flat config)                   |
| **Formatting**      | Prettier + Tailwind CSS plugin         |

### Wrangler Config (`wrangler.jsonc`)

- D1 database binding
- R2 bucket binding
- Asset directory for static files
- Observability settings

---

## Testing & QA

**Status**: No testing infrastructure configured.

- No test framework (Vitest, Jest, etc.)
- No test files in codebase
- No test scripts in package.json

### Manual Testing

```bash
pnpm dev           # Run locally
pnpm build          # Build check
pnpm lint           # Lint check
pnpm fmt.check      # Format check
```

### Known Testing Gaps

- Unit tests for `font-gen.ts` (critical — contains complex SVG → TTF logic)
- Integration tests for API routes
- E2E tests for main user flows (upload → preview → download)

---

## Configuration Files

| File                            | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `package.json`                  | Dependencies, scripts, workspace     |
| `tsconfig.json`                 | TypeScript + path aliases            |
| `vite.config.ts`                | Build config, Qwik plugins, adapters |
| `wrangler.jsonc`                | Cloudflare Workers config            |
| `drizzle.config.ts`             | ORM config                           |
| `eslint.config.js`              | Linting rules                        |
| `prettier.config.js`            | Code formatting                      |
| `scripts/fix-worker-import.mjs` | Post-build import patching           |

---

## Common Patterns

### Creating a New API Route

```typescript
// src/routes/api/example/index.ts
import type { RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async ({ json }) => {
  json(200, { data: "value" });
};
```

### Using routeAction$ with Zod

```typescript
import { routeAction$, zod$, z } from "@builder.io/qwik-city";
import { db } from "~/lib/db";

export const useCreateProject = routeAction$(
  async (data, requestEvent) => {
    return db.insert(projects).values(data);
  },
  zod$({
    name: z.string().min(1),
  }),
);
```

### Storage Pattern (with dev fallback)

```typescript
// storage.ts exports a bucket interface
// R2 in production, MockBucket for local dev
// Auto-detected based on environment
```
