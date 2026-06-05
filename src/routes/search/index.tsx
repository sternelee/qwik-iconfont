import {
  component$,
  useSignal,
  useStore,
  useTask$,
} from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { SvgPreview } from "~/components/svg-preview/svg-preview";
import { HighlightText } from "~/components/highlight-text/highlight-text";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";

// ── Types ──────────────────────────────────────────────────────────

interface SearchIcon {
  id: number;
  name: string;
  unicode: string | null;
  tags: string | null;
  view_box: string | null;
  content: string | null;
  // Project fields are `leftJoin`d, so Drizzle types them as nullable.
  // The page loader's WHERE visibility filter guarantees they're non-null
  // in practice, but the type reflects the SQL surface.
  project_id: number | null;
  project_name: string | null;
  project_font_family: string | null;
  project_visibility: string | null;
  project_favorites_count: number | null;
  author_name: string | null;
}

interface SearchResult {
  q: string;
  limit: number;
  icons: SearchIcon[];
}

interface ProjectGroup {
  id: number;
  name: string | null;
  font_family: string | null;
  visibility: string | null;
  favorites_count: number | null;
  author_name: string | null;
  icons: SearchIcon[];
}

// ── Loader ─────────────────────────────────────────────────────────

export const head: DocumentHead = {
  title: "搜索图标 - Iconfont",
  meta: [
    {
      name: "description",
      content: "按名称或标签搜索 Iconfont 公开图标库中的图标。",
    },
  ],
};

export const useSearchResults = routeLoader$(
  async ({ query, platform, request }): Promise<SearchResult> => {
    // `+` is a form-encoded space; the URL parser already decodes it but
    // we re-normalize defensively in case a hand-typed URL sneaks one in.
    const q = (query.get("q") ?? "").replace(/\+/g, " ").trim();
    if (!q || q.length > 100) {
      return { q, limit: 50, icons: [] };
    }

    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { icons, projects, user } = await import("~/lib/schema");
    const { eq, and, or, like, sql, asc, desc } = await import("drizzle-orm");
    const { getSessionFromRequest } = await import("~/lib/session");
    const session = await getSessionFromRequest(platform, request);

    // Note: LIKE wildcards in q are treated as wildcards; injection is
    // prevented by parameterized binding.
    const pattern = `%${q}%`;

    const visibility = session
      ? or(
          eq(projects.visibility, "public"),
          eq(projects.user_id, session.user.id),
        )
      : eq(projects.visibility, "public");

    const match = or(like(icons.name, pattern), like(icons.tags, pattern));
    const where = and(match, visibility);

    const rows = await db
      .select({
        id: icons.id,
        name: icons.name,
        unicode: icons.unicode,
        tags: icons.tags,
        view_box: icons.view_box,
        content: icons.content,
        project_id: projects.id,
        project_name: projects.name,
        project_font_family: projects.font_family,
        project_visibility: projects.visibility,
        project_favorites_count: projects.favorites_count,
        author_name: user.name,
      })
      .from(icons)
      .leftJoin(projects, eq(icons.project_id, projects.id))
      .leftJoin(user, eq(projects.user_id, user.id))
      .where(where)
      .orderBy(
        asc(sql`length(${icons.name})`),
        desc(projects.favorites_count),
        asc(icons.name),
      )
      .limit(50);

    return { q, limit: 50, icons: rows };
  },
);

// ── Page ───────────────────────────────────────────────────────────

export default component$(() => {
  const data = useSearchResults();

  // Client-side query string (editable; synced from server on each render)
  const q = useSignal(data.value.q);

  // Sync the input from the loader whenever it changes (form submit /
  // back/forward). Skip when the server returned an empty q so the
  // user's in-progress edit is never clobbered by the empty-state shape.
  useTask$(({ track }) => {
    const serverQ = track(() => data.value.q);
    if (serverQ && serverQ !== q.value) q.value = serverQ;
  });

  // Mirror loader results into a local store. useTask$ runs on both
  // server and client, so SSR sees the same data the client hydrates to.
  const results = useStore<{ list: SearchIcon[] }>({ list: data.value.icons });
  useTask$(({ track }) => {
    results.list = track(() => data.value.icons);
  });

  // Group results by project, then re-sort groups by the best (max)
  // project-favorites within each group so popular projects surface first
  // even when their shortest-matching icon is longer than a rival's.
  const groups = useStore<{ list: ProjectGroup[] }>({ list: [] });
  useTask$(({ track }) => {
    const list = track(() => results.list);
    // The WHERE visibility filter guarantees all joined fields are non-null
    // at runtime; the `!` assertions match the SearchIcon type surface.
    const map = new Map<number, ProjectGroup>();
    for (const ic of list) {
      const pid = ic.project_id!;
      let g = map.get(pid);
      if (!g) {
        g = {
          id: pid,
          name: ic.project_name,
          font_family: ic.project_font_family,
          visibility: ic.project_visibility,
          favorites_count: ic.project_favorites_count,
          author_name: ic.author_name,
          icons: [],
        };
        map.set(pid, g);
      }
      g.icons.push(ic);
    }
    groups.list = Array.from(map.values()).sort((a, b) => {
      const aMax = Math.max(
        ...a.icons.map((i) => i.project_favorites_count ?? 0),
      );
      const bMax = Math.max(
        ...b.icons.map((i) => i.project_favorites_count ?? 0),
      );
      if (bMax !== aMax) return bMax - aMax;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  });

  const hasQuery = q.value.length > 0;
  return (
    <div class="flex min-h-screen flex-col">
      {/* Top bar */}
      <header class="clay-navbar sticky top-0 z-30">
        <div class="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5">
          <a href="/" class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-md bg-rose-500 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <span class="text-lg font-extrabold tracking-tight text-rose-600">
              Iconfont
            </span>
          </a>

          {/* Search form (plain GET so the loader re-runs) */}
          <form
            method="get"
            action="/search"
            class="flex flex-1 items-center gap-2"
          >
            <div class="relative flex-1">
              <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-[var(--color-base-400)]">
                🔍
              </span>
              <input
                type="search"
                name="q"
                placeholder="按名称或标签搜索图标..."
                class="w-full rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-200)]/40 py-2 pr-3 pl-9 text-sm text-[var(--color-neutral)] focus:border-[var(--color-base-300)] focus:outline-none"
                value={q.value}
                onInput$={(e) =>
                  (q.value = (e.target as HTMLInputElement).value)
                }
                autoFocus
              />
            </div>
            <button
              type="submit"
              class="rounded-md bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 active:scale-95"
            >
              搜索
            </button>
          </form>

          <a
            href="/explore"
            class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] hover:bg-[var(--color-base-200)] sm:block"
          >
            探索
          </a>
          <ThemeToggle />
        </div>
      </header>

      {/* Body */}
      <main class="mx-auto w-full max-w-6xl flex-1 px-5 py-6">
        {!hasQuery ? (
          <EmptyState />
        ) : results.list.length === 0 ? (
          <NoMatchState q={q.value} />
        ) : (
          <>
            {/* Result summary */}
            <div class="mb-5 flex items-baseline justify-between">
              <p class="text-sm text-[var(--color-base-400)]">
                搜索{" "}
                <span class="font-semibold text-[var(--color-neutral)]">
                  "{q.value}"
                </span>{" "}
                · {results.list.length === data.value.limit ? "显示前" : "共"}{" "}
                <span class="font-semibold text-[var(--color-neutral)]">
                  {results.list.length}
                </span>{" "}
                个匹配图标
                {results.list.length === data.value.limit && (
                  <span class="ml-1 text-[var(--color-base-400)]">
                    （可能还有更多）
                  </span>
                )}
              </p>
            </div>

            {/* Groups */}
            <div class="space-y-8">
              {groups.list.map((group) => (
                <section key={group.id}>
                  <header class="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-base-300)] pb-2">
                    <div class="min-w-0">
                      <a
                        href={`/project/${group.id}/view`}
                        class="text-base font-extrabold text-[var(--color-neutral)] hover:text-rose-600"
                      >
                        <HighlightText text={group.name ?? ""} query={q.value} />
                      </a>
                      <p class="text-[11px] text-[var(--color-base-400)]">
                        {group.icons.length} 个匹配
                        {group.author_name && ` · ${group.author_name}`}
                        {group.visibility === "private" && (
                          <span class="ml-1 rounded-sm bg-[var(--color-base-200)] px-1 py-px text-[10px] font-semibold text-[var(--color-base-500)]">
                            私有
                          </span>
                        )}
                      </p>
                    </div>
                    <a
                      href={`/project/${group.id}/view`}
                      class="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      查看完整项目 →
                    </a>
                  </header>

                  <div class="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                    {group.icons.map((icon) => (
                      <a
                        key={icon.id}
                        href={`/project/${group.id}/view`}
                        title={`${icon.name}${icon.tags ? ` · ${icon.tags}` : ""}`}
                        class="group flex flex-col items-center gap-1 rounded-sm border border-transparent p-2 transition-all hover:border-[var(--color-base-300)] hover:bg-[var(--color-base-200)]/60"
                      >
                        <div class="flex h-9 w-9 items-center justify-center">
                          <SvgPreview
                            content={icon.content}
                            class="h-7 w-7"
                            color="#e11d48"
                          />
                        </div>
                        <span class="w-full truncate text-center text-[10px] font-medium text-[var(--color-neutral)]">
                          <HighlightText text={icon.name} query={q.value} />
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
});

// ── States ─────────────────────────────────────────────────────────

const EmptyState = component$(() => (
  <div class="flex flex-col items-center justify-center gap-4 py-24 text-center">
    <div class="flex h-16 w-16 items-center justify-center rounded-md bg-[var(--color-base-200)] text-3xl">
      🔍
    </div>
    <div>
      <p class="text-lg font-extrabold text-[var(--color-neutral)]">
        搜索 Iconfont 公开图标
      </p>
      <p class="mt-1 text-sm text-[var(--color-base-400)]">
        按图标名称或标签搜索，例如 "home"、"arrow"、"user"
      </p>
    </div>
    <div class="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
      {["home", "user", "arrow", "settings", "heart"].map((s) => (
        <a
          key={s}
          href={`/search?q=${s}`}
          class="rounded-sm border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-2.5 py-1 font-mono text-[var(--color-neutral)] hover:bg-[var(--color-base-200)]"
        >
          {s}
        </a>
      ))}
    </div>
  </div>
));

const NoMatchState = component$((props: { q: string }) => (
  <div class="flex flex-col items-center justify-center gap-3 py-24 text-center">
    <div class="text-3xl">🤷</div>
    <p class="text-base font-bold text-[var(--color-neutral)]">
      没有找到匹配 "{props.q}" 的图标
    </p>
    <p class="text-xs text-[var(--color-base-400)]">
      试试更短的关键字或不同的拼写
    </p>
  </div>
));
