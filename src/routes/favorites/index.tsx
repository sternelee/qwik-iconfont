import { component$, useSignal, $ } from "@builder.io/qwik";
import {
  routeLoader$,
  useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";
import type { Project } from "~/lib/types";
import { getSessionFromRequest } from "~/lib/session";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";
import { UserMenu } from "~/components/user-menu/user-menu";
export const head: DocumentHead = {
  title: "我的收藏 - Iconfont",
  meta: [
    {
      name: "description",
      content: "管理你在 Iconfont 收藏的公开图标集。",
    },
  ],
};

interface FavoriteProject extends Project {
  icon_count: number;
  favorited_at: string | null;
}

export const useFavorites = routeLoader$(
  async ({ platform, request, redirect }): Promise<FavoriteProject[]> => {
    const session = await getSessionFromRequest(platform, request);
    if (!session) throw redirect(302, "/login?redirect=/favorites");

    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { projects, icons, user, favorites } = await import("~/lib/schema");
    const { eq, desc, count } = await import("drizzle-orm");

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
        favorited_at: favorites.created_at,
      })
      .from(favorites)
      .innerJoin(projects, eq(favorites.project_id, projects.id))
      .leftJoin(user, eq(projects.user_id, user.id))
      .leftJoin(icons, eq(projects.id, icons.project_id))
      .where(eq(favorites.user_id, session.user.id))
      .groupBy(projects.id, favorites.created_at)
      .orderBy(desc(favorites.created_at));

    return result as FavoriteProject[];
  },
);

export default component$(() => {
  const favProjects = useFavorites();
  const nav = useNavigate();

  const removing = useSignal<number | null>(null);
  const localFavs = useSignal(favProjects.value);

  const handleUnfavorite = $(async (projectId: number) => {
    removing.value = projectId;
    try {
      const res = await fetch(`/api/projects/${projectId}/favorite`, {
        method: "DELETE",
      });
      if (res.ok) {
        localFavs.value = localFavs.value.filter((p) => p.id !== projectId);
      }
    } finally {
      removing.value = null;
    }
  });

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
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              探索
            </a>
            <a
              href="/favorites"
              class="rounded-md bg-[var(--color-base-200)] px-3 py-2 text-sm font-semibold text-[var(--color-neutral)]"
            >
              收藏
            </a>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Header */}
      <section class="border-b border-[var(--color-base-300)]">
        <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {/* Breadcrumb */}
          <nav class="mb-3 flex items-center gap-1.5 text-sm text-[var(--color-base-400)]">
            <a
              href="/"
              class="text-rose-500 transition-colors hover:text-rose-700"
            >
              首页
            </a>
            <span>/</span>
            <span class="font-medium text-[var(--color-neutral)]">
              我的收藏
            </span>
          </nav>
          <h1 class="text-2xl font-extrabold text-[var(--color-neutral)]">
            我的收藏
          </h1>
          <p class="mt-1 text-sm text-[var(--color-base-400)]">
            {localFavs.value.length > 0
              ? `共收藏了 ${localFavs.value.length} 个公开图标集`
              : "还没有收藏任何图标集"}
          </p>
        </div>
      </section>

      <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {localFavs.value.length === 0 ? (
          <div class="clay-card flex flex-col items-center justify-center py-24">
            <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-md bg-[var(--color-base-200)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-[var(--color-base-400)]"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <p class="text-base font-medium text-[var(--color-neutral)]">
              暂无收藏
            </p>
            <p class="mt-1 text-sm text-[var(--color-base-400)]">
              浏览探索页面，发现喜欢的图标集
            </p>
            <a
              href="/explore"
              class="clay-button mt-5 bg-rose-500 px-5 py-2 text-sm text-white"
            >
              去探索图标集
            </a>
          </div>
        ) : (
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {localFavs.value.map((project) => (
              <div
                key={project.id}
                class="clay-card group relative flex flex-col p-5"
              >
                {/* Unfavorite button */}
                <button
                  class="absolute top-3 right-3 rounded-md p-1.5 text-[var(--color-base-400)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--color-base-200)] hover:text-rose-500"
                  onClick$={() => handleUnfavorite(project.id)}
                  disabled={removing.value === project.id}
                  title="取消收藏"
                >
                  {removing.value === project.id ? (
                    <span class="loading loading-spinner loading-xs" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  )}
                </button>

                {/* Project info */}
                <div
                  class="flex-1 cursor-pointer"
                  onClick$={() => nav(`/project/${project.id}/view`)}
                >
                  <h3 class="truncate pr-6 text-base font-bold text-[var(--color-neutral)]">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p class="mt-1 line-clamp-2 text-xs text-[var(--color-base-400)]">
                      {project.description}
                    </p>
                  )}

                  {/* Author */}
                  <div class="mt-2 flex items-center gap-1.5">
                    <div class="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-base-200)] text-[9px] font-bold text-[var(--color-neutral)]">
                      {(project.author_name || project.author_email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <span class="text-xs text-[var(--color-base-400)]">
                      {project.author_name ||
                        project.author_email ||
                        "匿名作者"}
                    </span>
                  </div>

                  {/* Stats */}
                  <div class="mt-3 flex items-center gap-3 text-xs text-[var(--color-base-400)]">
                    <span>{project.icon_count} 图标</span>
                    <span>·</span>
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
                </div>

                {/* CTA */}
                <a
                  href={`/project/${project.id}/view`}
                  class="mt-4 block rounded-md bg-[var(--color-base-200)] py-2 text-center text-xs font-semibold text-[var(--color-neutral)] hover:bg-[var(--color-base-300)]"
                >
                  查看图标集
                </a>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
});
