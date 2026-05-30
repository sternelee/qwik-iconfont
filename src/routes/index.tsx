import {
  component$,
  useSignal,
  $,
  useStore,
  useTask$,
  useOnDocument,
  useVisibleTask$,
} from "@builder.io/qwik";
import { routeLoader$, routeAction$, useNavigate } from "@builder.io/qwik-city";
import type { Project } from "~/lib/types";
import { ToastContainer, type ToastItem } from "~/components/toast/toast";
import { SkeletonProjectCard } from "~/components/skeleton/skeleton";
import { HighlightText } from "~/components/highlight-text/highlight-text";
import { getSessionFromRequest } from "~/lib/session";
import {
  getLocalProjects,
  createLocalProject,
  deleteLocalProject,
  type LocalProject,
} from "~/lib/local-storage";

type LoadResult =
  | { mode: "server"; projects: (Project & { icon_count: number })[] }
  | { mode: "local"; projects: LocalProject[] };

export const useProjects = routeLoader$(
  async ({ platform, request }): Promise<LoadResult> => {
    const session = await getSessionFromRequest(platform, request);

    if (session) {
      // Authenticated — load from D1
      const { getDB, initDB } = await import("~/lib/db");
      const db = getDB(platform);
      await initDB(db, platform);
      const { projects, icons } = await import("~/lib/schema");
      const { eq, desc, count } = await import("drizzle-orm");

      const result = await db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          font_family: projects.font_family,
          prefix: projects.prefix,
          created_at: projects.created_at,
          updated_at: projects.updated_at,
          icon_count: count(icons.id),
        })
        .from(projects)
        .leftJoin(icons, eq(projects.id, icons.project_id))
        .where(eq(projects.user_id, session.user.id))
        .groupBy(projects.id)
        .orderBy(desc(projects.updated_at));

      return {
        mode: "server",
        projects: result as (Project & { icon_count: number })[],
      };
    }

    // Anonymous — return empty, client will load from localStorage
    return { mode: "local", projects: [] };
  },
);

export const useCreateProject = routeAction$(
  async (data, { platform, request }) => {
    const session = await getSessionFromRequest(platform, request);

    if (!session) {
      return { success: false, error: "Not authenticated", mode: "local" };
    }

    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { projects } = await import("~/lib/schema");

    const result = await db
      .insert(projects)
      .values({
        user_id: session.user.id,
        name: data.name as string,
        description: (data.description as string | undefined) ?? null,
        font_family: (data.font_family as string | undefined) ?? "iconfont",
        prefix: (data.prefix as string | undefined) ?? "icon-",
      })
      .returning();

    return { success: true, id: result[0].id, mode: "server" };
  },
);

export const useDeleteProject = routeAction$(
  async (data, { platform, request }) => {
    const session = await getSessionFromRequest(platform, request);

    if (!session) {
      return { success: false, error: "Not authenticated", mode: "local" };
    }

    const { getDB, initDB } = await import("~/lib/db");
    const { getBucket } = await import("~/lib/storage");
    const db = getDB(platform);
    await initDB(db, platform);
    const { icons, projects } = await import("~/lib/schema");
    const { eq, and } = await import("drizzle-orm");
    const bucket = getBucket(platform);
    const id = parseInt(data.id as string, 10);

    // Only delete if owned by this user
    const iconsResult = await db
      .select({ svg_path: icons.svg_path })
      .from(icons)
      .innerJoin(projects, eq(icons.project_id, projects.id))
      .where(
        and(eq(icons.project_id, id), eq(projects.user_id, session.user.id)),
      );

    for (const icon of iconsResult) {
      await bucket.delete(icon.svg_path);
    }

    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.user_id, session.user.id)));

    return { success: true, mode: "server" };
  },
);

export default component$(() => {
  const loaderData = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const nav = useNavigate();
  const showModal = useSignal(false);
  const searchQuery = useSignal("");
  const debouncedQuery = useSignal("");
  const sortProjects = useSignal<"date" | "name" | "count">("date");
  const deleting = useStore({ id: 0 });
  const showShortcuts = useSignal(false);

  // Local projects state (for anonymous users)
  const localProjects = useStore<{
    items: LocalProject[];
    loaded: false | true;
  }>({
    items: [],
    loaded: false,
  });

  // Load from localStorage if anonymous
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (loaderData.value.mode === "local") {
      localProjects.items = getLocalProjects();
      localProjects.loaded = true;
    }
  });

  // Toast state
  const toasts = useStore<{ items: ToastItem[] }>({ items: [] });
  const toastId = useSignal(0);
  const showToast = $((message: string, type: ToastItem["type"] = "info") => {
    const id = ++toastId.value;
    toasts.items = [...toasts.items, { id, message, type }];
    setTimeout(() => {
      toasts.items = toasts.items.filter((t) => t.id !== id);
    }, 3000);
  });

  // Dynamic page title
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    document.title = "Iconfont - 我的项目";
  });

  // Keyboard shortcuts
  useOnDocument(
    "keydown",
    $((ev: KeyboardEvent) => {
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
        // eslint-disable-next-line qwik/no-async-prevent-default
        ev.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder="搜索项目..."]',
        ) as HTMLInputElement;
        searchInput?.focus();
      }
    }),
  );

  // Confirm dialog state
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

  // Debounce search
  useTask$(({ track }) => {
    track(() => searchQuery.value);
    const timer = setTimeout(() => {
      debouncedQuery.value = searchQuery.value;
    }, 200);
    return () => clearTimeout(timer);
  });

  // Get active project list based on mode
  const activeProjects = () => {
    if (loaderData.value.mode === "local") {
      return localProjects.loaded ? localProjects.items : [];
    }
    return loaderData.value.projects;
  };

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

    if (sortProjects.value === "name") {
      list = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name));
    } else if (sortProjects.value === "count") {
      list = [...list].sort(
        (a: any, b: any) => (b.icon_count || 0) - (a.icon_count || 0),
      );
    }
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

  return (
    <div class="bg-base-200 min-h-screen">
      <ToastContainer toasts={toasts.items} />

      {/* Header */}
      <div class="navbar bg-base-100 px-4 shadow-sm">
        <div class="flex flex-1 items-center gap-3">
          <svg
            class="text-primary"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span class="text-xl font-bold">Iconfont</span>
          <span class="badge badge-sm badge-ghost">开源版</span>
          {isLocal && (
            <span class="badge badge-warning badge-sm">本地模式</span>
          )}
        </div>
        <div class="flex-none gap-2">
          {isLocal ? (
            <a href="/login" class="btn btn-ghost btn-sm">
              登录
            </a>
          ) : (
            <UserMenu />
          )}
          <button
            class="btn btn-primary btn-sm btn-press gap-1"
            onClick$={() => (showModal.value = true)}
          >
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
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            新建项目
          </button>
        </div>
      </div>

      {/* Main */}
      <div class="container mx-auto px-4 py-8">
        <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold">我的项目</h1>
            <span class="text-base-content/60 text-sm">
              {projectList.length} 个项目 ·{" "}
              {projectList.reduce(
                (s: number, p: any) => s + (p.icon_count || 0),
                0,
              )}{" "}
              个图标
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select
              class="select select-bordered select-sm"
              value={sortProjects.value}
              onChange$={(ev: any) => (sortProjects.value = ev.target.value)}
            >
              <option value="date">按时间</option>
              <option value="name">按名称</option>
              <option value="count">按图标数</option>
            </select>
            <div class="relative w-full sm:w-auto sm:min-w-[280px]">
              <input
                type="text"
                class="input input-bordered input-sm w-full pr-8 pl-9"
                placeholder="搜索项目..."
                value={searchQuery.value}
                onInput$={(ev: any) => (searchQuery.value = ev.target.value)}
              />
              <svg
                class="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
              {searchQuery.value && (
                <button
                  class="text-base-content/40 hover:text-base-content/70 absolute top-1/2 right-2 -translate-y-1/2"
                  onClick$={() => (searchQuery.value = "")}
                  title="清除搜索"
                >
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" x2="9" y1="9" y2="15" />
                    <line x1="9" x2="15" y1="9" y2="15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {projectList.length === 0 ? (
          <div class="card bg-base-100 border-base-200 border shadow-sm">
            <div class="card-body items-center py-16 text-center">
              <svg
                class="text-base-content/20 animate-empty-float mb-4"
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <h2 class="card-title text-lg">
                {debouncedQuery.value ? "未找到匹配的项目" : "还没有项目"}
              </h2>
              <p class="text-base-content/60 mb-4">
                {debouncedQuery.value
                  ? "尝试其他关键词"
                  : isLocal
                    ? "创建项目开始管理图标（数据保存在浏览器本地）"
                    : "创建你的第一个图标库，开始管理和生成 iconfont"}
              </p>
              {!debouncedQuery.value && (
                <button
                  class="btn btn-primary btn-sm gap-1"
                  onClick$={() => (showModal.value = true)}
                >
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
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                  新建项目
                </button>
              )}
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {createProject.isRunning && (
              <>
                <SkeletonProjectCard />
              </>
            )}
            {projectList.map((project: any, idx: number) => (
              <div
                key={project.id}
                class={`card bg-base-100 border-base-200 group card-hover-lift animate-card-fade-in border shadow-sm hover:shadow-lg stagger-${(idx % 8) + 1} ${deleting.id === project.id ? "pointer-events-none opacity-50" : ""}`}
              >
                <div
                  class="card-body cursor-pointer"
                  onClick$={() => nav(`/project/${project.id}`)}
                >
                  <div class="flex items-start justify-between">
                    <h2 class="card-title text-lg">
                      <HighlightText
                        text={project.name}
                        query={debouncedQuery.value}
                      />
                    </h2>
                    <button
                      class="btn btn-ghost btn-xs text-error transition-opacity md:opacity-0 md:group-hover:opacity-100"
                      onClick$={(ev: any) => {
                        ev.stopPropagation();
                        handleDelete(project);
                      }}
                      disabled={deleting.id === project.id}
                    >
                      {deleting.id === project.id ? (
                        <span class="loading loading-spinner loading-xs" />
                      ) : (
                        "删除"
                      )}
                    </button>
                  </div>
                  {project.description && (
                    <p class="text-base-content/60 line-clamp-2 text-sm">
                      <HighlightText
                        text={project.description}
                        query={debouncedQuery.value}
                      />
                    </p>
                  )}
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span class="badge badge-outline badge-sm">
                      {project.icon_count ?? 0} 个图标
                    </span>
                    <span class="badge badge-outline badge-sm">
                      Font: {project.font_family}
                    </span>
                    <span class="badge badge-outline badge-sm">
                      Prefix: {project.prefix}
                    </span>
                  </div>
                  <p class="text-base-content/50 mt-2 text-xs">
                    更新于 {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showModal.value && (
        <div class="modal modal-open p-4">
          <div class="modal-box animate-modal-box max-w-2xl overflow-hidden p-0">
            <div class="border-base-200 bg-base-200/60 border-b px-6 py-5">
              <h3 class="text-lg font-bold">新建项目</h3>
              <p class="text-base-content/60 mt-1 text-sm">
                设置项目名称、字体族和 class
                前缀，后续上传图标后会直接用于代码生成。
              </p>
            </div>
            <form preventdefault:submit onSubmit$={handleCreate}>
              <div class="grid gap-4 px-6 py-5 md:grid-cols-2">
                <div class="form-control md:col-span-2">
                  <label class="label justify-start pb-2">
                    <span class="label-text font-medium">项目名称 *</span>
                  </label>
                  <input
                    name="name"
                    type="text"
                    class="input input-bordered w-full"
                    placeholder="例如: my-icons"
                    required
                  />
                </div>
                <div class="form-control md:col-span-2">
                  <label class="label justify-start pb-2">
                    <span class="label-text font-medium">描述</span>
                  </label>
                  <textarea
                    name="description"
                    class="textarea textarea-bordered min-h-24 w-full"
                    placeholder="项目描述（可选）"
                  />
                </div>
                <div class="form-control">
                  <label class="label justify-start pb-2">
                    <span class="label-text font-medium">Font Family</span>
                  </label>
                  <input
                    name="font_family"
                    type="text"
                    class="input input-bordered w-full"
                    placeholder="iconfont"
                    value="iconfont"
                  />
                </div>
                <div class="form-control">
                  <label class="label justify-start pb-2">
                    <span class="label-text font-medium">Class 前缀</span>
                  </label>
                  <input
                    name="prefix"
                    type="text"
                    class="input input-bordered w-full"
                    placeholder="icon-"
                    value="icon-"
                  />
                </div>
                <div class="alert alert-info md:col-span-2">
                  <span class="text-sm">
                    生成 class 时会得到类似{" "}
                    <span class="text-primary font-mono font-medium">
                      icon-home
                    </span>{" "}
                    的名称。
                  </span>
                </div>
              </div>
              <div class="border-base-200 bg-base-200/40 modal-action mt-0 justify-end border-t px-6 py-4">
                <button
                  type="button"
                  class="btn"
                  onClick$={() => (showModal.value = false)}
                >
                  取消
                </button>
                <button type="submit" class="btn btn-primary">
                  创建
                </button>
              </div>
            </form>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => (showModal.value = false)}
          />
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmState.show && (
        <div class="modal modal-open">
          <div class="modal-box animate-modal-box max-w-sm">
            <h3 class="mb-2 text-lg font-bold">确认删除</h3>
            <p class="text-base-content/60 mb-4">
              确定要删除项目 "{confirmState.project?.name}"
              吗？此操作将删除项目下的所有图标，不可恢复。
            </p>
            <div class="modal-action">
              <button
                class="btn"
                onClick$={() => {
                  confirmState.show = false;
                  confirmState.project = null;
                }}
              >
                取消
              </button>
              <button class="btn btn-error" onClick$={confirmDelete}>
                删除
              </button>
            </div>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => {
              confirmState.show = false;
              confirmState.project = null;
            }}
          />
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcuts.value && (
        <div class="modal modal-open">
          <div class="modal-box animate-modal-box max-w-md">
            <h3 class="mb-4 text-lg font-bold">键盘快捷键</h3>
            <div class="space-y-2 text-sm">
              <div class="border-base-200 flex items-center justify-between border-b py-1">
                <span>搜索聚焦</span>
                <kbd class="kbd kbd-sm">/</kbd>
              </div>
              <div class="border-base-200 flex items-center justify-between border-b py-1">
                <span>关闭弹窗</span>
                <kbd class="kbd kbd-sm">Esc</kbd>
              </div>
              <div class="flex items-center justify-between py-1">
                <span>显示快捷键帮助</span>
                <kbd class="kbd kbd-sm">?</kbd>
              </div>
            </div>
            <div class="modal-action">
              <button
                class="btn btn-sm"
                onClick$={() => (showShortcuts.value = false)}
              >
                关闭
              </button>
            </div>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => (showShortcuts.value = false)}
          />
        </div>
      )}
    </div>
  );
});

/**
 * User menu component — shown when user is authenticated.
 * Displays user info and logout button.
 */
const UserMenu = component$(() => {
  const showMenu = useSignal(false);
  const nav = useNavigate();

  const handleSignOut = $(async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    nav("/");
  });

  return (
    <div class="dropdown dropdown-end">
      <label
        class="btn btn-ghost btn-sm gap-1"
        onClick$={() => (showMenu.value = !showMenu.value)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </label>
      {showMenu.value && (
        <ul class="menu dropdown-content bg-base-100 rounded-box z-1 w-40 p-2 shadow">
          <li>
            <button onClick$={handleSignOut}>退出登录</button>
          </li>
        </ul>
      )}
    </div>
  );
});
