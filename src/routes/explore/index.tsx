import {
  component$,
  useSignal,
  $,
  useStore,
  useTask$,
  noSerialize,
} from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import type { Project } from "~/lib/types";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";
export const head: DocumentHead = {
  title: "探索公开图标集 - Iconfont",
  meta: [
    {
      name: "description",
      content:
        "在 Iconfont 探索社区分享的公开图标集，浏览、收藏和 Fork 优质图标库。",
    },
  ],
};

interface ExploreProject extends Project {
  icon_count: number;
}

interface PageData {
  projects: ExploreProject[];
  nextCursor: string | null;
  hasMore: boolean;
}

const SORT_OPTIONS = [
  { key: "favorites", label: "最多收藏" },
  { key: "newest", label: "最新发布" },
  { key: "icons", label: "图标最多" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["key"];

// Module-level controller removed — now kept in component signal (noSerialize)
// to avoid rolldown "Cannot assign to import" error in QRL closures.

export const useInitialProjects = routeLoader$(
  async ({ platform, query }): Promise<PageData> => {
    const q = query.get("q") || "";
    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { projects, icons, user } = await import("~/lib/schema");
    const { eq, desc, count, and, like, or } = await import("drizzle-orm");

    const LIMIT = 24;
    const conditions: any[] = [eq(projects.visibility, "public")];
    if (q) {
      conditions.push(
        or(
          like(projects.name, `%${q}%`),
          like(projects.description, `%${q}%`),
          like(user.name, `%${q}%`),
        ),
      );
    }
    const whereClause =
      conditions.length === 1 ? conditions[0] : and(...conditions);

    const result = await db
      .select({
        id: projects.id,
        user_id: projects.user_id,
        name: projects.name,
        description: projects.description,
        font_family: projects.font_family,
        prefix: projects.prefix,
        visibility: projects.visibility,
        favorites_count: projects.favorites_count,
        author_name: user.name,
        author_email: user.email,
        author_image: user.image,
        created_at: projects.created_at,
        updated_at: projects.updated_at,
        icon_count: count(icons.id),
      })
      .from(projects)
      .leftJoin(icons, eq(projects.id, icons.project_id))
      .leftJoin(user, eq(projects.user_id, user.id))
      .where(whereClause)
      .groupBy(projects.id)
      .orderBy(desc(projects.favorites_count), desc(projects.id))
      .limit(LIMIT + 1);

    const hasMore = result.length > LIMIT;
    const items = hasMore ? result.slice(0, LIMIT) : result;
    return {
      projects: items as ExploreProject[],
      nextCursor: hasMore ? String(items[items.length - 1].id) : null,
      hasMore,
    };
  },
);

export default component$(() => {
  const initial = useInitialProjects();

  const search = useSignal("");
  const sort = useSignal<SortKey>("favorites");
  // AbortController kept in a noSerialize signal so QRL closures can mutate it
  // without triggering rolldown's "Cannot assign to import" error.
  const abortCtrl = useSignal(
    noSerialize<AbortController | undefined>(undefined),
  );
  const loading = useSignal(false);
  const loadingMore = useSignal(false);

  const state = useStore<{
    list: ExploreProject[];
    nextCursor: string | null;
    hasMore: boolean;
  }>({
    list: initial.value.projects,
    nextCursor: initial.value.nextCursor,
    hasMore: initial.value.hasMore,
  });

  // Client-side sort (applied on top of loaded data)
  const sortedList = useStore<{ items: ExploreProject[] }>({
    items: initial.value.projects,
  });

  const applySort = $(() => {
    const copy = [...state.list];
    if (sort.value === "favorites") {
      copy.sort((a, b) => b.favorites_count - a.favorites_count);
    } else if (sort.value === "newest") {
      copy.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
    } else if (sort.value === "icons") {
      copy.sort((a, b) => (b.icon_count || 0) - (a.icon_count || 0));
    }
    sortedList.items = copy;
  });

  // Fetch from API (search + cursor)
  const fetchProjects = $(async (reset: boolean) => {
    if (reset) {
      abortCtrl.value?.abort();
      abortCtrl.value = noSerialize(new AbortController());
      loading.value = true;
    } else {
      loadingMore.value = true;
    }
    const signal = reset ? abortCtrl.value?.signal : undefined;
    try {
      const params = new URLSearchParams({ visibility: "public", limit: "24" });
      if (search.value) params.set("q", search.value);
      if (!reset && state.nextCursor) params.set("cursor", state.nextCursor);

      const res = await fetch(
        `/api/projects?${params}`,
        signal ? { signal } : undefined,
      );
      if (!res.ok) return;
      const data = (await res.json()) as PageData;

      if (reset) {
        state.list = data.projects;
      } else {
        state.list = [...state.list, ...data.projects];
      }
      state.nextCursor = data.nextCursor;
      state.hasMore = data.hasMore;
      applySort();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    } finally {
      if (!signal?.aborted) {
        loading.value = false;
        loadingMore.value = false;
      }
    }
  });

  const searchTick = useSignal(0);

  // Search: debounce 300ms before fetching
  useTask$(({ track, cleanup }) => {
    track(() => searchTick.value);
    if (searchTick.value === 0) return;
    const timer = setTimeout(() => {
      fetchProjects(true);
    }, 300);
    cleanup(() => clearTimeout(timer));
  });

  // Re-sort when sort changes
  useTask$(({ track }) => {
    track(() => sort.value);
    applySort();
  });

  // Infinite scroll sentinel
  const sentinel = useSignal<HTMLDivElement | undefined>();
  useTask$(({ cleanup }) => {
    if (typeof window === "undefined") return;
    if (!sentinel.value) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && state.hasMore && !loadingMore.value) {
          fetchProjects(false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel.value);
    cleanup(() => observer.disconnect());
  });

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("zh-CN") : "-";

  return (
    <div class="min-h-screen">
      {/* Navbar */}
      <header class="clay-navbar sticky top-0 z-30">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="/" class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-rose-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span class="text-lg font-extrabold tracking-tight text-rose-600">
              Iconfont
            </span>
          </a>
          <div class="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="/"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              首页
            </a>
            <a
              href="/explore"
              class="hidden rounded-md bg-[var(--color-base-200)] px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] sm:block"
            >
              探索
            </a>
            <a
              href="/favorites"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              收藏
            </a>
          </div>
        </div>
      </header>

      {/* Header */}
      <section class="sticky top-14 z-10 border-b border-[var(--color-base-300)]">
        <div class="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Title */}
            <div class="flex-shrink-0">
              <h1 class="text-xl font-extrabold text-[var(--color-neutral)]">
                探索图标集
              </h1>
            </div>

            {/* Search */}
            <div class="relative max-w-sm flex-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-base-400)]"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="搜索项目名、作者..."
                class="input-clay w-full py-2 pr-3 pl-8 text-sm"
                value={search.value}
                onInput$={(e) => {
                  search.value = (e.target as HTMLInputElement).value;
                  searchTick.value++;
                }}
              />
            </div>

            {/* Sort tabs */}
            <div class="flex rounded-sm border border-[var(--color-base-300)] bg-[var(--color-base-100)] p-1 text-sm">
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  class={`rounded-sm px-3 py-1.5 font-medium transition-all ${
                    sort.value === key
                      ? "bg-rose-500 text-white"
                      : "text-[var(--color-neutral)] hover:bg-[var(--color-base-200)]"
                  }`}
                  onClick$={() => (sort.value = key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <span class="flex-shrink-0 text-xs text-[var(--color-base-400)]">
              {sortedList.items.length} 个{state.hasMore ? "+" : ""}
            </span>
          </div>
        </div>
      </section>

      {/* Grid */}
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {loading.value ? (
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                class="h-44 animate-pulse rounded-md bg-[var(--color-base-200)]"
              />
            ))}
          </div>
        ) : sortedList.items.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-24 text-[var(--color-base-400)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <p class="mt-3 text-sm">
              {search.value
                ? `没有匹配「${search.value}」的图标集`
                : "还没有公开图标集，快来创建第一个！"}
            </p>
            <a
              href="/"
              class="clay-button mt-4 bg-rose-500 px-5 py-2 text-sm text-white"
            >
              创建图标集
            </a>
          </div>
        ) : (
          <>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedList.items.map((project) => (
                <a
                  key={project.id}
                  href={`/project/${project.id}/view`}
                  class="group flex flex-col rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] p-5 transition-all hover:border-[var(--color-base-300)]"
                >
                  {/* Header */}
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <h3 class="truncate text-base font-bold text-[var(--color-neutral)]">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p class="mt-0.5 line-clamp-2 text-xs text-[var(--color-base-400)]">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <span class="flex-shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">
                      公开
                    </span>
                  </div>

                  {/* Author */}
                  <div class="mt-3 flex items-center gap-1.5">
                    <div class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-base-200)] text-[9px] font-bold text-[var(--color-neutral)]">
                      {(project.author_name || project.author_email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <span class="truncate text-xs text-[var(--color-neutral)]">
                      {project.author_name ||
                        project.author_email ||
                        "匿名作者"}
                    </span>
                    <span class="text-[var(--color-base-300)]">·</span>
                    <span class="flex-shrink-0 text-xs text-[var(--color-base-400)]">
                      {formatDate(project.created_at)}
                    </span>
                  </div>

                  {/* Stats */}
                  <div class="mt-auto flex items-center justify-between border-t border-[var(--color-base-300)] pt-4 text-xs text-[var(--color-base-400)]">
                    <div class="flex items-center gap-3">
                      <span>{project.icon_count} 图标</span>
                      <span class="flex items-center gap-0.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          class="text-[var(--color-base-400)]"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        {project.favorites_count}
                      </span>
                    </div>
                    <span class="rounded-full bg-[var(--color-base-200)] px-2 py-0.5 font-medium text-[var(--color-neutral)]">
                      {project.font_family}
                    </span>
                  </div>
                </a>
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinel} class="mt-8 flex justify-center">
              {loadingMore.value && (
                <span class="loading loading-spinner loading-sm text-[var(--color-base-400)]" />
              )}
              {!loadingMore.value &&
                !state.hasMore &&
                sortedList.items.length > 0 && (
                  <p class="text-xs text-[var(--color-base-400)]">已加载全部</p>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});
