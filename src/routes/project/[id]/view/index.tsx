import {
  component$,
  useSignal,
  $,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";
import type { Project, Icon } from "~/lib/types";
import { generateTTFFont, generateCSS } from "~/lib/font-gen";
import {
  AddToProjectDrawer,
  type AddToProjectIcon,
} from "~/components/add-to-project/add-to-project";
import { SvgPreview } from "~/components/svg-preview/svg-preview";
import { getSessionFromRequest } from "~/lib/session";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";

// ── Types ──────────────────────────────────────────────────────────

interface PublicProjectData {
  project: Project;
  icons: Icon[];
  isFavorited: boolean;
  isOwner: boolean;
  userId: string | null;
}

// ── Loader ─────────────────────────────────────────────────────────

export const usePublicProject = routeLoader$(
  async ({ params, platform, request, error }): Promise<PublicProjectData> => {
    const id = parseInt(params.id, 10);
    const session = await getSessionFromRequest(platform, request);

    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { projects, icons, user, favorites } = await import("~/lib/schema");
    const { eq, and } = await import("drizzle-orm");

    const projectResult = await db
      .select({
        id: projects.id,
        user_id: projects.user_id,
        name: projects.name,
        description: projects.description,
        font_family: projects.font_family,
        prefix: projects.prefix,
        visibility: projects.visibility,
        favorites_count: projects.favorites_count,
        views_count: projects.views_count,
        downloads_count: projects.downloads_count,
        author_name: user.name,
        author_email: user.email,
        author_image: user.image,
        created_at: projects.created_at,
        updated_at: projects.updated_at,
      })
      .from(projects)
      .leftJoin(user, eq(projects.user_id, user.id))
      .where(eq(projects.id, id));

    const project = projectResult[0] as Project | undefined;
    if (!project) throw error(404, "项目不存在");

    if (project.visibility !== "public") {
      if (!session || session.user.id !== project.user_id) {
        throw error(403, "该项目未公开");
      }
    }

    const iconsResult = await db
      .select()
      .from(icons)
      .where(eq(icons.project_id, id))
      .orderBy(icons.created_at);

    let isFavorited = false;
    if (session) {
      const favResult = await db
        .select()
        .from(favorites)
        .where(
          and(
            eq(favorites.user_id, session.user.id),
            eq(favorites.project_id, id),
          ),
        );
      isFavorited = favResult.length > 0;
    }

    return {
      project,
      icons: iconsResult as Icon[],
      isFavorited,
      isOwner: session?.user.id === project.user_id,
      userId: session?.user.id ?? null,
    };
  },
);

// ── Main Page ──────────────────────────────────────────────────────

export default component$(() => {
  const data = usePublicProject();
  const loc = useLocation();
  const { project, icons, isOwner } = data.value;

  const search = useSignal("");
  const isFavorited = useSignal(data.value.isFavorited);
  const favCount = useSignal(project.favorites_count);
  const favLoading = useSignal(false);
  const forkLoading = useSignal(false);
  const forkDone = useSignal<number | null>(null);
  const downloadLoading = useSignal(false);
  const copied = useSignal<string | null>(null);
  const toast = useSignal<string | null>(null);
  const filteredIcons = useStore<{ list: Icon[] }>({ list: icons });
  // Add-to-project drawer
  const addingIcon = useSignal<AddToProjectIcon | null>(null);
  const closeDrawer = $(() => {
    addingIcon.value = null;
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const q = track(() => search.value).toLowerCase();
    filteredIcons.list = q
      ? icons.filter(
          (ic) =>
            ic.name.toLowerCase().includes(q) ||
            (ic.tags || "").toLowerCase().includes(q),
        )
      : icons;
  });

  // Track view count
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    fetch(`/api/projects/${project.id}/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view" }),
    });
  });

  const showToast = $((msg: string) => {
    toast.value = msg;
    setTimeout(() => (toast.value = null), 2500);
  });

  const handleFavorite = $(async () => {
    if (!data.value.userId) {
      window.location.href = `/login?redirect=${encodeURIComponent(loc.url.pathname)}`;
      return;
    }
    favLoading.value = true;
    try {
      const method = isFavorited.value ? "DELETE" : "POST";
      const res = await fetch(`/api/projects/${project.id}/favorite`, {
        method,
      });
      if (res.ok) {
        const body = (await res.json()) as any;
        isFavorited.value = !isFavorited.value;
        favCount.value = body.favorites_count ?? favCount.value;
      }
    } finally {
      favLoading.value = false;
    }
  });

  const handleFork = $(async () => {
    if (!data.value.userId) {
      window.location.href = `/login?redirect=${encodeURIComponent(loc.url.pathname)}`;
      return;
    }
    forkLoading.value = true;
    try {
      const res = await fetch(`/api/projects/${project.id}/fork`, {
        method: "POST",
      });
      const body = (await res.json()) as any;
      if (res.ok) {
        forkDone.value = body.projectId;
        await showToast(`已 Fork 到您的项目: ${body.name}`);
      } else {
        await showToast(body.error || "Fork 失败");
      }
    } finally {
      forkLoading.value = false;
    }
  });

  const handleDownload = $(async () => {
    if (filteredIcons.list.length === 0) return;
    downloadLoading.value = true;
    try {
      const ttf = await generateTTFFont(
        project.font_family,
        filteredIcons.list,
        project.prefix,
      );
      const css = generateCSS(
        project.font_family,
        project.prefix,
        filteredIcons.list,
      );
      if (ttf) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(
          new Blob([ttf], { type: "font/truetype" }),
        );
        a.download = `${project.font_family}.ttf`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      const ca = document.createElement("a");
      ca.href = URL.createObjectURL(new Blob([css], { type: "text/css" }));
      ca.download = `${project.font_family}.css`;
      ca.click();
      URL.revokeObjectURL(ca.href);
      // Track download
      fetch(`/api/projects/${project.id}/stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download" }),
      });
      await showToast("字体已下载");
    } finally {
      downloadLoading.value = false;
    }
  });

  const handleCopy = $(async (text: string) => {
    await navigator.clipboard.writeText(text);
    copied.value = text;
    setTimeout(() => (copied.value = null), 1500);
  });

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("zh-CN") : "-";

  return (
    <div class="min-h-screen bg-rose-50/30">
      {/* Toast */}
      {toast.value && (
        <div class="fixed top-4 right-4 z-50 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast.value}
        </div>
      )}

      {/* Add-to-project drawer */}
      {addingIcon.value && (
        <AddToProjectDrawer
          icon={addingIcon.value}
          userId={data.value.userId}
          onClose$={closeDrawer}
        />
      )}

      {/* Navbar */}
      <nav class="sticky top-0 z-30 border-b border-rose-100 bg-white/70 backdrop-blur">
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
              class="rounded-xl px-3 py-1.5 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50"
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

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <section class="border-b border-rose-100 bg-white/70 backdrop-blur">
        <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Meta */}
            <div class="flex-1">
              <div class="mb-2 flex items-center gap-2">
                <a
                  href="/"
                  class="flex items-center gap-1 text-sm text-rose-400 transition-all hover:text-rose-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  首页
                </a>
                <span class="text-rose-200">/</span>
                <a
                  href="/explore"
                  class="text-sm text-rose-400 transition-all hover:text-rose-600"
                >
                  探索
                </a>
                <span class="text-rose-200">/</span>
                <span class="max-w-[200px] truncate text-sm font-medium text-rose-600">
                  {project.name}
                </span>
              </div>
              <h1 class="font-['Nunito'] text-2xl font-extrabold text-rose-950 sm:text-3xl">
                {project.name}
              </h1>
              {project.description && (
                <p class="mt-1 max-w-xl text-sm text-rose-700/60">
                  {project.description}
                </p>
              )}
              <div class="mt-3 flex items-center gap-2">
                <div class="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
                  {(project.author_name || project.author_email || "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <span class="text-sm text-rose-700">
                  {project.author_name || project.author_email || "匿名作者"}
                </span>
                <span class="text-rose-200">·</span>
                <span class="text-xs text-rose-400">
                  {formatDate(project.created_at)}
                </span>
              </div>
              <div class="mt-4 flex flex-wrap items-center gap-4 text-sm text-rose-600">
                <span class="flex items-center gap-1.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <strong>{icons.length}</strong> 个图标
                </span>
                <span class="flex items-center gap-1.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="text-rose-400"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <strong>{favCount.value}</strong> 收藏
                </span>
                <span class="flex items-center gap-1.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <strong>{project.views_count ?? 0}</strong> 浏览
                </span>
                <span class="flex items-center gap-1.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  <strong>{project.downloads_count ?? 0}</strong> 下载
                </span>
                <span class="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600">
                  {project.font_family}
                </span>
                <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                  公开
                </span>
              </div>
            </div>

            {/* Actions */}
            <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
              {!isOwner && (
                <button
                  class="flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  onClick$={handleFork}
                  disabled={forkLoading.value}
                >
                  {forkLoading.value ? (
                    <span class="loading loading-spinner loading-xs" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  )}
                  {forkDone.value ? "已 Fork" : "Fork"}
                </button>
              )}
              {isOwner && (
                <a
                  href={`/project/${project.id}`}
                  class="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  编辑项目
                </a>
              )}
              <button
                class={`clay-button flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold transition-all ${isFavorited.value ? "bg-rose-500 text-white" : "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"}`}
                onClick$={handleFavorite}
                disabled={favLoading.value}
              >
                {favLoading.value ? (
                  <span class="loading loading-spinner loading-xs" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={isFavorited.value ? "currentColor" : "none"}
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                )}
                {isFavorited.value ? "已收藏" : "收藏"}
              </button>
              <button
                class="clay-button flex items-center gap-1.5 rounded-2xl bg-rose-500 px-4 py-2 text-sm font-bold text-white"
                onClick$={handleDownload}
                disabled={downloadLoading.value || icons.length === 0}
              >
                {downloadLoading.value ? (
                  <span class="loading loading-spinner loading-xs" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                )}
                下载字体
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Search + Grid ────────────────────────────────────────── */}
      <div class="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="relative max-w-xs flex-1">
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
              placeholder="搜索图标名称或标签..."
              class="w-full rounded-2xl border border-rose-100 bg-white py-2 pr-3 pl-8 text-sm text-rose-800 placeholder:text-rose-300 focus:border-rose-300 focus:outline-none"
              value={search.value}
              onInput$={(e) =>
                (search.value = (e.target as HTMLInputElement).value)
              }
            />
          </div>
          <span class="text-xs text-rose-400">
            {filteredIcons.list.length} / {icons.length} 图标
          </span>
        </div>

        {filteredIcons.list.length === 0 ? (
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
              {search.value ? "没有匹配的图标" : "该项目暂无图标"}
            </p>
          </div>
        ) : (
          <div class="grid grid-cols-3 gap-3 pb-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {filteredIcons.list.map((icon) => (
              <div
                key={icon.id}
                class="group relative flex flex-col items-center gap-1.5 rounded-2xl border border-rose-50 bg-white p-3 text-center transition-all hover:border-rose-200 hover:shadow-sm"
              >
                {/* Click icon to copy name */}
                <button
                  class="flex h-10 w-10 items-center justify-center"
                  onClick$={() => handleCopy(icon.name)}
                  title={`复制名称: ${icon.name}`}
                >
                  <SvgPreview
                    content={icon.content}
                    class="h-8 w-8"
                    color="#e11d48"
                  />
                </button>
                <span class="w-full truncate text-[10px] font-medium text-rose-700">
                  {icon.name}
                </span>
                {icon.unicode && (
                  <span class="text-[9px] text-rose-300">{icon.unicode}</span>
                )}

                {/* Add to project button — appears on hover */}
                <button
                  class="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white opacity-0 shadow transition-all group-hover:opacity-100 hover:bg-rose-600 active:scale-95"
                  title="添加到我的项目"
                  onClick$={() => {
                    addingIcon.value = {
                      id: icon.id,
                      name: icon.name,
                      content: icon.content,
                      unicode: icon.unicode,
                      view_box: icon.view_box,
                    };
                  }}
                >
                  +
                </button>

                {copied.value === icon.name && (
                  <div class="absolute inset-0 flex items-center justify-center rounded-2xl bg-rose-500/90">
                    <span class="text-xs font-semibold text-white">已复制</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Usage + CDN ──────────────────────────────────────────── */}
      <section class="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div class="rounded-3xl border border-rose-100 bg-white/60 p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-['Nunito'] text-lg font-extrabold text-rose-950">
              使用方法
            </h2>
            {isOwner && (
              <PublishButton
                projectId={project.id}
                fontFamily={project.font_family}
                prefix={project.prefix}
                icons={icons}
              />
            )}
          </div>
          <CdnSnippet
            projectId={project.id}
            fontFamily={project.font_family}
            prefix={project.prefix}
          />
        </div>
      </section>
    </div>
  );
});

// ── PublishButton ──────────────────────────────────────────────────

const PublishButton = component$<{
  projectId: number;
  fontFamily: string;
  prefix: string;
  icons: Icon[];
}>((props) => {
  const publishing = useSignal(false);
  const publishedUrl = useSignal<string | null>(null);
  const err = useSignal<string | null>(null);

  const handlePublish = $(async () => {
    if (props.icons.length === 0) return;
    publishing.value = true;
    err.value = null;
    try {
      const { generateTTFFont, generateCSS } = await import("~/lib/font-gen");
      const ttf = await generateTTFFont(
        props.fontFamily,
        props.icons,
        props.prefix,
      );
      const css = generateCSS(props.fontFamily, props.prefix, props.icons);
      if (!ttf) {
        err.value = "字体生成失败";
        return;
      }
      const bytes = new Uint8Array(ttf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const res = await fetch(`/api/projects/${props.projectId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttf: b64, css }),
      });
      const body = (await res.json()) as any;
      if (res.ok) publishedUrl.value = body.cssUrl;
      else err.value = body.error || "发布失败";
    } finally {
      publishing.value = false;
    }
  });

  return (
    <div class="flex items-center gap-2">
      {publishedUrl.value && (
        <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
          ✓ 已发布
        </span>
      )}
      {err.value && <span class="text-xs text-red-500">{err.value}</span>}
      <button
        class="flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
        onClick$={handlePublish}
        disabled={publishing.value || props.icons.length === 0}
      >
        {publishing.value && (
          <span class="loading loading-spinner loading-xs" />
        )}
        发布到 CDN
      </button>
    </div>
  );
});

// ── CdnSnippet ─────────────────────────────────────────────────────

const CdnSnippet = component$<{
  projectId: number;
  fontFamily: string;
  prefix: string;
}>((props) => {
  const published = useSignal<{ cssUrl: string; ttfUrl: string } | null>(null);
  const copied = useSignal<string | null>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const res = await fetch(`/api/projects/${props.projectId}/publish`);
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.published)
        published.value = { cssUrl: data.cssUrl, ttfUrl: data.ttfUrl };
    }
  });

  const copyText = $(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    copied.value = key;
    setTimeout(() => (copied.value = null), 1500);
  });

  const cssLink = published.value
    ? `<link rel="stylesheet" href="${published.value.cssUrl}">`
    : `<!-- 下载字体 或 点击「发布到 CDN」获取在线链接 -->\n<link rel="stylesheet" href="./${props.fontFamily}.css">`;

  const usage = `<i class="${props.prefix} ${props.prefix}icon-name"></i>`;

  return (
    <div class="space-y-4 text-sm">
      {published.value && (
        <div class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
          <p class="mb-1 text-xs font-semibold text-emerald-800">
            ✓ CDN 在线链接已可用
          </p>
          <div class="flex items-center gap-2">
            <code class="flex-1 truncate text-xs text-emerald-700">
              {published.value.cssUrl}
            </code>
            <button
              class="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-200"
              onClick$={() => copyText(published.value!.cssUrl, "cdn")}
            >
              {copied.value === "cdn" ? "已复制" : "复制"}
            </button>
          </div>
        </div>
      )}
      <div>
        <p class="mb-1 font-semibold text-rose-800">1. 引入 CSS</p>
        <div class="flex items-start gap-2">
          <pre class="flex-1 overflow-x-auto rounded-xl bg-rose-50 p-3 text-xs text-rose-600">
            {cssLink}
          </pre>
          <button
            class="mt-0.5 flex-shrink-0 rounded-xl bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
            onClick$={() => copyText(cssLink, "css")}
          >
            {copied.value === "css" ? "已复制" : "复制"}
          </button>
        </div>
      </div>
      <div>
        <p class="mb-1 font-semibold text-rose-800">2. 使用图标</p>
        <div class="flex items-start gap-2">
          <pre class="flex-1 rounded-xl bg-rose-50 p-3 text-xs text-rose-600">
            {usage}
          </pre>
          <button
            class="mt-0.5 flex-shrink-0 rounded-xl bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
            onClick$={() => copyText(usage, "usage")}
          >
            {copied.value === "usage" ? "已复制" : "复制"}
          </button>
        </div>
      </div>
    </div>
  );
});
