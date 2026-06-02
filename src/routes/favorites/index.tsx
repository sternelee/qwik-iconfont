import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, useNavigate } from "@builder.io/qwik-city";
import type { Project } from "~/lib/types";
import { getSessionFromRequest } from "~/lib/session";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";

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
            <span class="text-sm font-bold text-rose-900">
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
              class="rounded-xl px-3 py-1.5 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50"
            >
              探索
            </a>
            <a
              href="/favorites"
              class="rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700"
            >
              收藏
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Header */}
      <section class="border-b border-rose-100 bg-white/70 backdrop-blur">
        <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {/* Breadcrumb */}
          <nav class="mb-3 flex items-center gap-1.5 text-sm text-rose-400">
            <a
              href="/"
              class="text-rose-500 transition-all hover:text-rose-700"
            >
              首页
            </a>
            <span>/</span>
            <span class="font-medium text-rose-700">我的收藏</span>
          </nav>
          <h1 class="text-2xl font-extrabold text-rose-950">
            我的收藏
          </h1>
          <p class="mt-1 text-sm text-rose-500">
            {localFavs.value.length > 0
              ? `共收藏了 ${localFavs.value.length} 个公开图标集`
              : "还没有收藏任何图标集"}
          </p>
        </div>
      </section>

      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {localFavs.value.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-24 text-rose-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p class="mt-4 text-base font-medium text-rose-400">暂无收藏</p>
            <a
              href="/explore"
              class="mt-4 rounded-2xl bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600"
            >
              去探索图标集
            </a>
          </div>
        ) : (
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {localFavs.value.map((project) => (
              <div
                key={project.id}
                class="group relative flex flex-col rounded-3xl border border-rose-100 bg-white p-5 transition-all hover:border-rose-200 hover:shadow-md"
              >
                {/* Unfavorite button */}
                <button
                  class="absolute top-3 right-3 rounded-xl p-1.5 text-rose-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500"
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
                  <h3 class="truncate pr-6 text-base font-bold text-rose-950">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p class="mt-1 line-clamp-2 text-xs text-rose-500/70">
                      {project.description}
                    </p>
                  )}

                  {/* Author */}
                  <div class="mt-2 flex items-center gap-1.5">
                    <div class="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-600">
                      {(project.author_name || project.author_email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <span class="text-xs text-rose-500">
                      {project.author_name ||
                        project.author_email ||
                        "匿名作者"}
                    </span>
                  </div>

                  {/* Stats */}
                  <div class="mt-3 flex items-center gap-3 text-xs text-rose-400">
                    <span>{project.icon_count} 图标</span>
                    <span>·</span>
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
                </div>

                {/* CTA */}
                <a
                  href={`/project/${project.id}/view`}
                  class="mt-4 block rounded-2xl bg-rose-50 py-2 text-center text-xs font-semibold text-rose-600 hover:bg-rose-100"
                >
                  查看图标集
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
