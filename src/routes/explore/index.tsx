import {
  component$,
  useSignal,
  $,
  useStore,
  useVisibleTask$,
  noSerialize,
} from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import type { Project } from "~/lib/types";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";

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
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => searchTick.value);
    if (searchTick.value === 0) return;
    const timer = setTimeout(() => {
      fetchProjects(true);
    }, 300);
    cleanup(() => clearTimeout(timer));
  });

  // Re-sort when sort changes
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => sort.value);
    applySort();
  });

  // Infinite scroll sentinel
  const sentinel = useSignal<HTMLDivElement | undefined>();
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
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
    <div class="min-h-screen bg-rose-50/30">
      {/* Navbar */}
      <nav class="sticky top-0 z-20 border-b border-rose-100 bg-white/70 backdrop-blur">
        <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="/" class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-rose-500 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <span class="font-['Nunito'] text-sm font-bold text-rose-900">
              Iconfont
            </span>
          </a>
          <div class="flex items-center gap-2">
            <a
              href="/"
              class="rounded-xl px-3 py-1.5 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50"
            >
              首页
            </a>
            <a
              href="/explore"
              class="rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700"
            >
              探索
            </a>
            <a
              href="/favorites"
              class="rounded-xl px-3 py-1.5 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50"
            >
              收藏
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Header */}
      <section class="sticky top-14 z-10 border-b border-rose-100 bg-white/70 backdrop-blur">
        <div class="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Title */}
            <div class="flex-shrink-0">
              <h1 class="font-['Nunito'] text-xl font-extrabold text-rose-950">
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
                class="absolute top-1/2 left-3 -translate-y-1/2 text-rose-300"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="搜索项目名、作者..."
                class="w-full rounded-2xl border border-rose-100 bg-white py-2 pr-3 pl-8 text-sm text-rose-800 placeholder:text-rose-300 focus:border-rose-300 focus:outline-none"
                value={search.value}
                onInput$={(e) => {
                  search.value = (e.target as HTMLInputElement).value;
                  searchTick.value++;
                }}
              />
            </div>

            {/* Sort tabs */}
            <div class="flex rounded-2xl border border-rose-100 bg-white p-1 text-sm">
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  class={`rounded-xl px-3 py-1.5 font-medium transition-all ${
                    sort.value === key
                      ? "bg-rose-500 text-white"
                      : "text-rose-500 hover:bg-rose-50"
                  }`}
                  onClick$={() => (sort.value = key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <span class="flex-shrink-0 text-xs text-rose-400">
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
                class="h-44 animate-pulse rounded-3xl bg-rose-100/50"
              />
            ))}
          </div>
        ) : sortedList.items.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-24 text-rose-300">
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
              class="mt-4 rounded-2xl bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600"
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
                  class="group flex flex-col rounded-3xl border border-rose-100 bg-white p-5 transition-all hover:border-rose-200 hover:shadow-md"
                >
                  {/* Header */}
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <h3 class="truncate font-['Nunito'] text-base font-bold text-rose-950">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p class="mt-0.5 line-clamp-2 text-xs text-rose-500/70">
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
                    <div class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-600">
                      {(project.author_name || project.author_email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <span class="truncate text-xs text-rose-500">
                      {project.author_name ||
                        project.author_email ||
                        "匿名作者"}
                    </span>
                    <span class="text-rose-200">·</span>
                    <span class="flex-shrink-0 text-xs text-rose-400">
                      {formatDate(project.created_at)}
                    </span>
                  </div>

                  {/* Stats */}
                  <div class="mt-auto flex items-center justify-between border-t border-rose-50 pt-4 text-xs text-rose-400">
                    <div class="flex items-center gap-3">
                      <span>{project.icon_count} 图标</span>
                      <span class="flex items-center gap-0.5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          class="text-rose-400"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        {project.favorites_count}
                      </span>
                    </div>
                    <span class="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-500">
                      {project.font_family}
                    </span>
                  </div>
                </a>
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinel} class="mt-8 flex justify-center">
              {loadingMore.value && (
                <span class="loading loading-spinner loading-sm text-rose-400" />
              )}
              {!loadingMore.value &&
                !state.hasMore &&
                sortedList.items.length > 0 && (
                  <p class="text-xs text-rose-300">已加载全部</p>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});
