import {
  component$,
  useSignal,
  $,
  useStore,
  useTask$,
} from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";
import type { Project } from "~/lib/types";

export const head: DocumentHead = {
  title: "Iconfont - 图标字体管理平台",
  meta: [
    {
      name: "description",
      content:
        "开源 SVG 图标集管理与图标字体生成平台。上传 SVG，一键生成 TTF、CSS 和 Symbol 精灵图。",
    },
  ],
};
import { ToastContainer, type ToastItem } from "~/components/toast/toast";
import { SkeletonProjectCard } from "~/components/skeleton/skeleton";
import { HighlightText } from "~/components/highlight-text/highlight-text";
import { GithubImport } from "~/components/github-import/github-import";
import { UserMenu } from "~/components/user-menu/user-menu";
import { getSessionFromRequest } from "~/lib/session";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";
import { MobileNav } from "~/components/mobile-nav/mobile-nav";
import {
  getLocalProjects,
  createLocalProject,
  deleteLocalProject,
  type LocalProject,
} from "~/lib/local-storage";

type LoadResult =
  | {
      mode: "server";
      projects: (Project & { icon_count: number })[];
      quota: {
        plan: string;
        maxProjects: number;
        maxIconsPerProject: number;
      } | null;
    }
  | { mode: "local"; projects: LocalProject[]; quota: null };

export const useProjects = routeLoader$(
  async ({ platform, request }): Promise<LoadResult> => {
    const session = await getSessionFromRequest(platform, request);
    if (session) {
      const { getDB, initDB } = await import("~/lib/db");
      const db = getDB(platform);
      await initDB(db, platform);
      const { projects, icons, user } = await import("~/lib/schema");
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
        })
        .from(projects)
        .leftJoin(icons, eq(projects.id, icons.project_id))
        .leftJoin(user, eq(projects.user_id, user.id))
        .where(eq(projects.user_id, session.user.id))
        .groupBy(projects.id)
        .orderBy(desc(projects.updated_at));
      // Fetch user plan for quota display
      const { getQuota } = await import("~/lib/quota");
      const userResult = await db
        .select({ plan: user.plan })
        .from(user)
        .where(eq(user.id, session.user.id));
      const plan = userResult[0]?.plan ?? "free";
      const quota = getQuota(plan);

      return {
        mode: "server",
        projects: result as (Project & { icon_count: number })[],
        quota: {
          plan,
          maxProjects: quota.maxProjects,
          maxIconsPerProject: quota.maxIconsPerProject,
        },
      };
    }
    return { mode: "local", projects: [], quota: null };
  },
);

export const useFeaturedProjects = routeLoader$(
  async ({ platform }): Promise<(Project & { icon_count: number })[]> => {
    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { projects, icons, user } = await import("~/lib/schema");
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
        views_count: projects.views_count,
        downloads_count: projects.downloads_count,
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
      .where(eq(projects.visibility, "public"))
      .groupBy(projects.id)
      .orderBy(
        desc(projects.favorites_count),
        desc(projects.views_count),
        desc(projects.downloads_count),
        desc(projects.id),
      )
      .limit(8);

    return result as (Project & { icon_count: number })[];
  },
);

export const usePlatformStats = routeLoader$(
  async ({ platform }): Promise<{ projectCount: number; iconCount: number }> => {
    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { projects, icons } = await import("~/lib/schema");
    const { eq, count } = await import("drizzle-orm");

    const projectResult = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.visibility, "public"));

    const iconResult = await db
      .select({ count: count() })
      .from(icons)
      .innerJoin(projects, eq(icons.project_id, projects.id))
      .where(eq(projects.visibility, "public"));

    return {
      projectCount: projectResult[0]?.count ?? 0,
      iconCount: iconResult[0]?.count ?? 0,
    };
  },
);

export const useCreateProject = routeAction$(
  async (data, { platform, request }) => {
    const session = await getSessionFromRequest(platform, request);
    if (!session)
      return { success: false, error: "Not authenticated", mode: "local" };
    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { projects } = await import("~/lib/schema");
    const result = await db
      .insert(projects)
      .values({
        user_id: session.user.id,
        name: data.name as string,
        description: (data.description as string) ?? null,
        font_family: (data.font_family as string) ?? "iconfont",
        prefix: (data.prefix as string) ?? "icon-",
        visibility: (data.visibility as string) ?? "private",
      })
      .returning();
    return { success: true, id: result[0].id, mode: "server" };
  },
);

export const useDeleteProject = routeAction$(
  async (data, { platform, request }) => {
    const session = await getSessionFromRequest(platform, request);
    if (!session)
      return { success: false, error: "Not authenticated", mode: "local" };
    const { getDB, initDB } = await import("~/lib/db");
    const { getBucket } = await import("~/lib/storage");
    const db = getDB(platform);
    await initDB(db, platform);
    const { icons, projects } = await import("~/lib/schema");
    const { eq, and } = await import("drizzle-orm");
    const bucket = getBucket(platform);
    const id = parseInt(data.id as string, 10);
    const iconsResult = await db
      .select({ svg_path: icons.svg_path })
      .from(icons)
      .innerJoin(projects, eq(icons.project_id, projects.id))
      .where(
        and(eq(icons.project_id, id), eq(projects.user_id, session.user.id)),
      );
    for (const icon of iconsResult) await bucket.delete(icon.svg_path);
    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.user_id, session.user.id)));
    return { success: true, mode: "server" };
  },
);

export default component$(() => {
  const loaderData = useProjects();
  const featuredProjects = useFeaturedProjects();
  const platformStats = usePlatformStats();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const nav = useNavigate();
  const showModal = useSignal(false);
  const showGithubImport = useSignal(false);
  const searchQuery = useSignal("");
  const debouncedQuery = useSignal("");
  const sortProjects = useSignal<"date" | "name" | "count">("date");
  const deleting = useStore({ id: 0 });
  const showShortcuts = useSignal(false);
  const localProjects = useStore<{ items: LocalProject[]; loaded: boolean }>({
    items: [],
    loaded: false,
  });
  const toasts = useStore<{ items: ToastItem[] }>({ items: [] });
  const toastId = useSignal(0);

  const showToast = $((message: string, type: ToastItem["type"] = "info") => {
    const id = ++toastId.value;
    toasts.items = [...toasts.items, { id, message, type }];
    setTimeout(() => {
      toasts.items = toasts.items.filter((t) => t.id !== id);
    }, 3000);
  });

  useTask$(() => {
    if (typeof window === "undefined") return;
    if (loaderData.value.mode === "local") {
      localProjects.items = getLocalProjects();
      localProjects.loaded = true;
    }
  });

  useTask$(() => {
    if (typeof window === "undefined") return;
    document.title = "Iconfont - 图标字体管理平台";
  });

  useTask$(({ cleanup }) => {
    if (typeof window === "undefined") return;
    const handler = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      )
        return;
      if (ev.key === "Escape") {
        if (showModal.value) {
          showModal.value = false;
          return;
        }
        if (showShortcuts.value) {
          showShortcuts.value = false;
          return;
        }
      }
      if (ev.key === "?" && !ev.shiftKey) {
        showShortcuts.value = true;
        return;
      }
      if (ev.key === "/") {
        ev.preventDefault();
        (
          document.querySelector(
            'input[placeholder="搜索项目..."]',
          ) as HTMLInputElement
        )?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    cleanup(() => document.removeEventListener("keydown", handler));
  });

  const confirmState = useStore<{ show: boolean; project: any | null }>({
    show: false,
    project: null,
  });

  const confirmDelete = $(async () => {
    const project = confirmState.project;
    if (!project) return;
    confirmState.show = false;
    deleting.id = project.id;
    if (loaderData.value.mode === "local") {
      deleteLocalProject(project.id);
      localProjects.items = getLocalProjects();
      showToast(`项目 "${project.name}" 已删除`, "success");
    } else {
      await deleteProject.submit({ id: String(project.id) });
      showToast(`项目 "${project.name}" 已删除`, "success");
      nav("/", { replaceState: true });
    }
    deleting.id = 0;
  });

  useTask$(({ track }) => {
    track(() => searchQuery.value);
    const timer = setTimeout(() => {
      debouncedQuery.value = searchQuery.value;
    }, 200);
    return () => clearTimeout(timer);
  });

  const activeProjects = () =>
    loaderData.value.mode === "local"
      ? localProjects.loaded
        ? localProjects.items
        : []
      : loaderData.value.projects;

  const filtered = () => {
    const source = activeProjects();
    let list = debouncedQuery.value
      ? source.filter(
          (p: any) =>
            p.name.toLowerCase().includes(debouncedQuery.value.toLowerCase()) ||
            (p.description || "")
              .toLowerCase()
              .includes(debouncedQuery.value.toLowerCase()),
        )
      : [...source];
    if (sortProjects.value === "name")
      list = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name));
    else if (sortProjects.value === "count")
      list = [...list].sort(
        (a: any, b: any) => (b.icon_count || 0) - (a.icon_count || 0),
      );
    return list;
  };

  const handleDelete = $((project: any) => {
    confirmState.project = project;
    confirmState.show = true;
  });

  const handleCreate = $(async (ev: any) => {
    const fd = new FormData(ev.target);
    const name = fd.get("name") as string;
    const description = (fd.get("description") as string) || null;
    const font_family = (fd.get("font_family") as string) || "iconfont";
    const prefix = (fd.get("prefix") as string) || "icon-";
    if (loaderData.value.mode === "local") {
      const project = createLocalProject({
        name,
        description: description || undefined,
        font_family,
        prefix,
      });
      localProjects.items = getLocalProjects();
      showModal.value = false;
      showToast(`项目 "${name}" 创建成功`, "success");
      nav(`/project/${project.id}`);
    } else {
      const result = await createProject.submit({
        name,
        description,
        font_family,
        prefix,
      });
      showModal.value = false;
      if (result.value.success && result.value.id) {
        showToast(`项目 "${name}" 创建成功`, "success");
        nav(`/project/${result.value.id}`);
      } else {
        showToast("项目创建失败", "error");
        nav("/", { replaceState: true });
      }
    }
  });

  const isLocal = loaderData.value.mode === "local";
  const projectList = filtered();
  const totalIcons = projectList.reduce(
    (s: number, p: any) => s + (p.icon_count || 0),
    0,
  );

  return (
    <div class="min-h-screen">
      <ToastContainer toasts={toasts.items} />

      {/* ── Navbar ────────────────────────────────────────────── */}
      <header class="clay-navbar sticky top-0 z-30">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Left: Logo */}
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
            <div class="flex flex-col">
              <span class="text-lg font-extrabold tracking-tight text-rose-600">
                Iconfont
              </span>
              <span class="-mt-0.5 text-[10px] font-medium tracking-wider text-[var(--color-base-400)]">
                开源版
              </span>
            </div>
          </a>

          {/* Right: Actions */}
          <div class="flex items-center gap-3">
            <ThemeToggle />
            <MobileNav />
            {/* Search link */}
            <a
              href="/search"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              搜索
            </a>
            {/* Explore link */}
            <a
              href="/explore"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              探索
            </a>
            {isLocal && (
              <span class="rounded-full bg-[var(--color-base-200)] px-3 py-1 text-xs font-semibold text-amber-700">
                本地模式
              </span>
            )}
            {isLocal ? (
              <a
                href="/login"
                class="rounded-md px-4 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
              >
                登录
              </a>
            ) : (
              <UserMenu />
            )}
            <button
              class="clay-button flex items-center gap-2 bg-rose-500 px-5 py-2.5 text-sm font-bold text-white"
              onClick$={() => (showModal.value = true)}
            >
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
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              新建项目
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ──────────────────────────────────────── */}
      <section class="relative mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20">
        <div class="relative z-10 flex flex-col items-center text-center">
          <div class="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-base-100)] px-4 py-2">
            <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span class="text-sm font-medium text-[var(--color-neutral)]">
              已支持 {platformStats.value.iconCount} 个图标 · {platformStats.value.projectCount} 个项目
            </span>
          </div>

          <h1
            class="animate-fade-in-up text-4xl font-black tracking-tight text-[var(--color-neutral)] sm:text-5xl lg:text-6xl"
            style="animation-delay: 0.08s"
          >
            创建你的专属
            <br />
            <span class="bg-gradient-to-r from-rose-500 via-rose-400 to-blue-500 bg-clip-text text-transparent">
              图标字体
            </span>
          </h1>

          <p
            class="animate-fade-in-up mt-5 max-w-xl text-base leading-relaxed text-[var(--color-base-400)] sm:text-lg"
            style="animation-delay: 0.16s"
          >
            上传 SVG，一键生成 TTF 字体、CSS 样式和 Symbol 精灵图。
            <br class="hidden sm:block" />
            让图标管理变得简单有趣。
          </p>

          <div
            class="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-4"
            style="animation-delay: 0.24s"
          >
            <button
              class="clay-button flex items-center gap-2 bg-rose-500 px-7 py-3.5 text-base font-bold text-white"
              onClick$={() => (showModal.value = true)}
            >
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
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              开始创建项目
            </button>
            <button
              class="clay-button-secondary flex items-center gap-2 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-6 py-3.5 text-base font-bold text-[var(--color-neutral)] hover:border-[var(--color-base-400)] hover:bg-[var(--color-base-200)]"
              onClick$={() => (showGithubImport.value = true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              从 GitHub 导入
            </button>
            {featuredProjects.value.length > 0 && (
              <a
                href="#featured"
                class="clay-button-secondary flex items-center gap-2 bg-blue-500 px-7 py-3.5 text-base font-bold text-white"
              >
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
                  <path d="m6 9 6 6 6-6" />
                </svg>
                浏览推荐图标
              </a>
            )}
          </div>

          {/* Hero Icon Grid Preview */}
          <div
            class="animate-fade-in-up mt-14 grid grid-cols-8 gap-3 sm:grid-cols-12"
            style="animation-delay: 0.32s"
          >
            {[
              "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
              "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
              "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
              "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8c.79 0 1.5-.71 1.5-1.5S8.79 9 8 9s-1.5.71-1.5 1.5S7.21 12 8 12zm8 0c.79 0 1.5-.71 1.5-1.5S16.79 9 16 9s-1.5.71-1.5 1.5.71 1.5 1.5 1.5zm-4 5.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z",
              "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
              "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z",
              "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
              "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
              "M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z",
              "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z",
              "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z",
              "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
            ].map((d, i) => (
              <div
                key={i}
                class="animate-fade-in-scale clay-icon-card flex aspect-square items-center justify-center p-2 sm:p-3"
                style={`animation-delay: ${0.4 + i * 0.04}s`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-5 w-5 text-[var(--color-base-400)] sm:h-6 sm:w-6"
                >
                  <path d={d} />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Icon Sets ────────────────────────────────── */}
      <section
        id="featured"
        class="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6"
      >
        <div class="mb-8 flex items-end justify-between">
          <div>
            <h2 class="text-2xl font-extrabold text-[var(--color-neutral)] sm:text-3xl">
              推荐图标集
            </h2>
            <p class="mt-1 text-sm text-[var(--color-base-400)]">
              精选热门风格，一键创建相似项目
            </p>
          </div>
          <span class="featured-badge">热门</span>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProjects.value.length > 0 ? (
            featuredProjects.value.map((project, idx) => (
              <div
                key={project.id}
                class="animate-fade-in-up clay-card group cursor-pointer p-5"
                style={`animation-delay: ${idx * 0.08}s`}
                onClick$={() => nav(`/project/${project.id}/view`)}
              >
                {/* Project preview */}
                <div class="mb-4 flex items-center gap-3">
                  <div class="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-rose-400 to-rose-500 text-lg font-extrabold text-white">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="truncate text-base font-bold text-[var(--color-neutral)]">
                      {project.name}
                    </h3>
                    <div class="mt-0.5 flex items-center gap-2">
                      <span class="text-[10px] font-medium text-[var(--color-base-400)]">
                        {project.author_name || "匿名作者"}
                      </span>
                      <span class="rounded-full bg-[var(--color-base-200)] px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                        公开
                      </span>
                    </div>
                  </div>
                </div>

                <div class="clay-inset mb-3 flex items-center gap-3 px-3 py-2">
                  <div class="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#E11D48"
                      stroke-width="2"
                      class="text-[var(--color-base-400)]"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span class="text-xs font-semibold text-[var(--color-base-400)]">
                      {project.icon_count || 0}
                    </span>
                  </div>
                  <div class="h-3 w-px bg-rose-200" />
                  <div class="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#E11D48"
                      stroke-width="2"
                      class="text-[var(--color-base-400)]"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span class="text-xs font-semibold text-[var(--color-base-400)]">
                      {project.favorites_count || 0}
                    </span>
                  </div>
                </div>

                <p class="line-clamp-2 text-xs text-[var(--color-base-400)]">
                  {project.description || "暂无描述"}
                </p>
              </div>
            ))
          ) : (
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-[var(--color-base-400)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
              <p class="mt-3 text-sm">还没有公开图标集</p>
              <button
                class="clay-button mt-4 bg-rose-500 px-5 py-2 text-sm text-white"
                onClick$={() => (showModal.value = true)}
              >
                创建第一个
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section class="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div class="mb-8 text-center">
          <h2 class="text-2xl font-extrabold text-[var(--color-neutral)] sm:text-3xl">
            核心功能
          </h2>
          <p class="mt-2 text-sm text-[var(--color-base-400)]">
            为开发者和设计师打造的图标工作流
          </p>
        </div>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "图标字体生成",
              desc: "一键将 SVG 转为 TTF 字体、CSS 类名和 Symbol 精灵图，前端接入零配置。",
              icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
            },
            {
              title: "COLRv0 彩色字体",
              desc: "提取多色 SVG 的颜色层，生成原生彩色字体，现代浏览器直接渲染多彩图标。",
              icon: "M12 3a9 9 0 0 0 0 18 9 9 0 0 0 0-18zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14z M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z",
            },
            {
              title: "AI 辅助设计",
              desc: "通过自然语言描述生成 SVG 图标，或让 AI 修改现有图标，降低设计门槛。",
              icon: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
            },
            {
              title: "开源与协作",
              desc: "发布公开图标集，浏览社区作品，收藏和 Fork 他人的项目，共建图标生态。",
              icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
            },
          ].map((f, idx) => (
            <div
              key={f.title}
              class="animate-fade-in-up clay-card p-5"
              style={`animation-delay: ${idx * 0.06}s`}
            >
              <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-base-200)]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-rose-500"
                >
                  <path d={f.icon} />
                </svg>
              </div>
              <h3 class="mb-1 text-sm font-bold text-[var(--color-neutral)]">
                {f.title}
              </h3>
              <p class="text-xs leading-relaxed text-[var(--color-base-400)]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main class="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Section header */}
        <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 class="text-2xl font-extrabold text-[var(--color-neutral)]">
              我的项目
            </h2>
            <p class="mt-1 text-sm text-[var(--color-base-400)]">
              {projectList.length} 个项目 · {totalIcons} 个图标
            </p>
            {/* Quota bar */}
            {loaderData.value.mode === "server" &&
              loaderData.value.quota &&
              loaderData.value.quota.maxProjects !== Infinity && (
                <div class="mt-2 flex items-center gap-2 text-xs text-[var(--color-base-400)]">
                  <span class="rounded-full bg-[var(--color-base-200)] px-2 py-0.5 font-medium">
                    {loaderData.value.quota.plan}
                  </span>
                  <span>
                    项目 {projectList.length}/
                    {loaderData.value.quota.maxProjects}
                  </span>
                  <div class="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-base-200)]">
                    <div
                      class="h-full rounded-full bg-rose-400"
                      style={`width:${Math.min(100, (projectList.length / loaderData.value.quota.maxProjects) * 100)}%`}
                    />
                  </div>
                </div>
              )}
          </div>

          <div class="flex items-center gap-2">
            <select
              class="input-clay px-3 py-2 text-sm"
              value={sortProjects.value}
              onChange$={(ev: any) => (sortProjects.value = ev.target.value)}
            >
              <option value="date">按时间</option>
              <option value="name">按名称</option>
              <option value="count">按图标数</option>
            </select>
            <div class="relative">
              <input
                type="text"
                class="input-clay w-52 py-2 pr-8 pl-9 text-sm"
                placeholder="搜索项目..."
                value={searchQuery.value}
                onInput$={(ev: any) => (searchQuery.value = ev.target.value)}
              />
              <svg
                class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-base-400)]"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {projectList.length === 0 ? (
          <div class="animate-fade-in-up clay-card flex flex-col items-center justify-center py-20">
            <div class="mb-5 flex h-24 w-24 items-center justify-center rounded-md bg-[var(--color-base-200)]">
              <svg
                class="h-12 w-12 text-[var(--color-base-400)]"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h2 class="mb-2 text-lg font-bold text-[var(--color-neutral)]">
              {debouncedQuery.value ? "未找到匹配的项目" : "还没有项目"}
            </h2>
            <p class="mb-6 max-w-sm text-center text-sm text-[var(--color-base-400)]">
              {debouncedQuery.value
                ? "尝试其他关键词"
                : isLocal
                  ? "创建项目开始管理图标（数据保存在浏览器本地）"
                  : "创建你的第一个图标库，开始管理和生成 iconfont"}
            </p>
            {!debouncedQuery.value && (
              <div class="flex flex-col items-center gap-3">
                <button
                  class="clay-button flex items-center gap-2 bg-rose-500 px-6 py-2.5 text-sm font-bold text-white"
                  onClick$={() => (showModal.value = true)}
                >
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
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                  新建项目
                </button>
                <div class="flex items-center gap-4">
                  <a
                    href="/guide"
                    class="text-xs font-medium text-[var(--color-neutral)] transition-colors hover:text-[var(--color-base-400)]"
                  >
                    查看使用指南 →
                  </a>
                  {isLocal && (
                    <a
                      href="/register"
                      class="text-xs font-medium text-[var(--color-neutral)] transition-colors hover:text-[var(--color-base-400)]"
                    >
                      注册账号，数据上云 →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Project Grid */
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {createProject.isRunning && <SkeletonProjectCard />}
            {projectList.map((project: any, idx: number) => (
              <div
                key={project.id}
                class={`animate-fade-in-up clay-card group stagger-${(idx % 8) + 1} ${deleting.id === project.id ? "pointer-events-none opacity-50" : ""}`}
              >
                <div
                  class="cursor-pointer p-6"
                  onClick$={() => nav(`/project/${project.id}`)}
                >
                  <div class="mb-4 flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <div class="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-rose-400 to-rose-500 text-white">
                        <span class="text-lg font-bold">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div class="flex flex-col">
                        <h3 class="text-lg font-bold text-[var(--color-neutral)]">
                          <HighlightText
                            text={project.name}
                            query={debouncedQuery.value}
                          />
                        </h3>
                        <div class="mt-0.5 flex items-center gap-1.5">
                          {project.visibility === "public" ? (
                            <span class="rounded-full bg-[var(--color-base-200)] px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                              公开
                            </span>
                          ) : (
                            <span class="rounded-full bg-[var(--color-base-200)] px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                              私有
                            </span>
                          )}
                          {project.favorites_count > 0 && (
                            <span class="flex items-center gap-0.5 text-[10px] text-[var(--color-base-400)]">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                              >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                              {project.favorites_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      class="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-base-400)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--color-base-200)] hover:text-[var(--color-neutral)]"
                      onClick$={(ev: any) => {
                        ev.stopPropagation();
                        handleDelete(project);
                      }}
                      disabled={deleting.id === project.id}
                    >
                      {deleting.id === project.id ? (
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
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {project.description && (
                    <p class="mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--color-base-400)]">
                      <HighlightText
                        text={project.description}
                        query={debouncedQuery.value}
                      />
                    </p>
                  )}

                  {/* Stats bar */}
                  <div class="clay-inset mb-4 flex items-center gap-4 px-4 py-2.5">
                    <div class="flex items-center gap-1.5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="text-[var(--color-base-400)]"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span class="text-xs font-semibold text-[var(--color-base-400)]">
                        {project.icon_count ?? 0}
                      </span>
                    </div>
                    <div class="h-4 w-px bg-rose-200" />
                    <span class="max-w-[80px] truncate text-xs text-[var(--color-base-400)]">
                      {project.author_name || "我"}
                    </span>
                    <div class="h-4 w-px bg-rose-200" />
                    <span class="font-mono text-xs text-[var(--color-base-400)]">
                      {project.font_family}
                    </span>
                    <div class="h-4 w-px bg-rose-200" />
                    <span class="font-mono text-xs text-[var(--color-base-400)]">
                      {project.prefix}
                    </span>
                  </div>

                  <div class="flex items-center justify-between">
                    <span class="text-xs text-[var(--color-base-400)]">
                      {new Date(project.updated_at).toLocaleDateString("zh-CN")}
                    </span>
                    <span class="flex items-center gap-1 text-xs font-semibold text-[var(--color-base-400)] transition-colors group-hover:text-[var(--color-neutral)]">
                      管理
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Create Project Modal ──────────────────────────────── */}
      {showModal.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-lg">
            <div class="border-b border-[var(--color-base-300)] px-6 py-4">
              <h3 class="text-lg font-bold text-[var(--color-neutral)]">
                新建项目
              </h3>
              <p class="mt-1 text-sm text-[var(--color-base-400)]">
                设置项目名称和配置，后续上传图标后用于代码生成。
              </p>
            </div>
            <form preventdefault:submit onSubmit$={handleCreate}>
              <div class="space-y-4 px-6 py-5">
                <div class="form-control">
                  <label class="label py-1">
                    <span class="label-text text-sm font-semibold text-[var(--color-neutral)]">
                      项目名称 *
                    </span>
                  </label>
                  <input
                    name="name"
                    type="text"
                    class="input-clay w-full px-4 py-2.5 text-sm"
                    placeholder="例如: my-icons"
                    required
                  />
                </div>
                <div class="form-control">
                  <label class="label py-1">
                    <span class="label-text text-sm font-semibold text-[var(--color-neutral)]">
                      描述
                    </span>
                  </label>
                  <textarea
                    name="description"
                    class="input-clay w-full px-4 py-2.5 text-sm"
                    rows={2}
                    placeholder="项目描述（可选）"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-control">
                    <label class="label py-1">
                      <span class="label-text text-sm font-semibold text-[var(--color-neutral)]">
                        Font Family
                      </span>
                    </label>
                    <input
                      name="font_family"
                      type="text"
                      class="input-clay w-full px-4 py-2.5 text-sm"
                      value="iconfont"
                    />
                  </div>
                  <div class="form-control">
                    <label class="label py-1">
                      <span class="label-text text-sm font-semibold text-[var(--color-neutral)]">
                        Class 前缀
                      </span>
                    </label>
                    <input
                      name="prefix"
                      type="text"
                      class="input-clay w-full px-4 py-2.5 text-sm"
                      value="icon-"
                    />
                  </div>
                </div>
                <div class="form-control">
                  <label class="label py-1">
                    <span class="label-text text-sm font-semibold text-[var(--color-neutral)]">
                      可见性
                    </span>
                  </label>
                  <div class="flex gap-2">
                    <label class="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-4 py-2.5 transition-all has-[:checked]:border-[var(--color-neutral)] has-[:checked]:bg-[var(--color-base-200)]">
                      <input
                        type="radio"
                        name="visibility"
                        value="private"
                        class="radio radio-sm"
                        defaultChecked
                      />
                      <span class="text-sm text-[var(--color-neutral)]">
                        私有
                      </span>
                    </label>
                    <label class="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-4 py-2.5 transition-all has-[:checked]:border-emerald-500 has-[:checked]:bg-[var(--color-base-200)]">
                      <input
                        type="radio"
                        name="visibility"
                        value="public"
                        class="radio radio-sm"
                      />
                      <span class="text-sm text-[var(--color-neutral)]">
                        公开
                      </span>
                    </label>
                  </div>
                  <label class="label">
                    <span class="label-text-alt text-xs text-[var(--color-base-400)]">
                      公开项目将展示在首页推荐中，所有人可见
                    </span>
                  </label>
                </div>
                <div class="rounded-md bg-[var(--color-base-200)] px-4 py-3 text-xs text-[var(--color-neutral)]">
                  生成 class 时会得到类似{" "}
                  <span class="font-mono font-semibold">icon-home</span>{" "}
                  的名称。
                </div>
              </div>
              <div class="flex justify-end gap-3 border-t border-[var(--color-base-300)] px-6 py-4">
                <button
                  type="button"
                  class="rounded-md px-5 py-2.5 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
                  onClick$={() => (showModal.value = false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  class="clay-button bg-rose-500 px-6 py-2.5 text-sm font-bold text-white"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
          <div
            class="modal-backdrop"
            onClick$={() => (showModal.value = false)}
          />
        </div>
      )}

      {/* ── Confirm Delete Modal ──────────────────────────────── */}
      {confirmState.show && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-sm text-center">
            <div class="p-6">
              <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-[var(--color-base-200)]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#E11D48"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <h3 class="text-lg font-bold text-[var(--color-neutral)]">
                确认删除
              </h3>
              <p class="mt-2 text-sm text-[var(--color-base-400)]">
                确定要删除项目 "{confirmState.project?.name}"
                吗？此操作将删除项目下的所有图标，不可恢复。
              </p>
              <div class="mt-5 flex justify-center gap-3">
                <button
                  class="rounded-md px-5 py-2.5 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
                  onClick$={() => {
                    confirmState.show = false;
                    confirmState.project = null;
                  }}
                >
                  取消
                </button>
                <button
                  class="clay-button bg-rose-500 px-6 py-2.5 text-sm font-bold text-white"
                  onClick$={confirmDelete}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
          <div
            class="modal-backdrop"
            onClick$={() => {
              confirmState.show = false;
              confirmState.project = null;
            }}
          />
        </div>
      )}

      {/* ── Keyboard Shortcuts ─────────────────────────────────── */}
      {showShortcuts.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-xs">
            <div class="p-5">
              <h3 class="mb-4 text-base font-bold text-[var(--color-neutral)]">
                键盘快捷键
              </h3>
              <div class="space-y-2 text-sm">
                {[
                  ["搜索聚焦", "/"],
                  ["关闭弹窗", "Esc"],
                  ["快捷键帮助", "?"],
                ].map(([label, key]) => (
                  <div
                    class="flex items-center justify-between py-1"
                    key={label}
                  >
                    <span class="text-[var(--color-base-400)]">{label}</span>
                    <kbd class="rounded-md bg-[var(--color-base-200)] px-2 py-1 text-xs font-semibold text-[var(--color-neutral)]">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
              <div class="mt-4 flex justify-end">
                <button
                  class="rounded-md px-4 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
                  onClick$={() => (showShortcuts.value = false)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
          <div
            class="modal-backdrop"
            onClick$={() => (showShortcuts.value = false)}
          />
        </div>
      )}

      {/* ── GitHub Import Modal ──────────────────────────────────────── */}
      {showGithubImport.value && (
        <GithubImport onClose$={() => (showGithubImport.value = false)} />
      )}
    </div>
  );
});
