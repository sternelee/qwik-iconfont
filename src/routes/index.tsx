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
      return { mode: "server", projects: result as (Project & { icon_count: number })[] };
    }
    return { mode: "local", projects: [] };
  },
);

export const useCreateProject = routeAction$(
  async (data, { platform, request }) => {
    const session = await getSessionFromRequest(platform, request);
    if (!session) return { success: false, error: "Not authenticated", mode: "local" };
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
      })
      .returning();
    return { success: true, id: result[0].id, mode: "server" };
  },
);

export const useDeleteProject = routeAction$(
  async (data, { platform, request }) => {
    const session = await getSessionFromRequest(platform, request);
    if (!session) return { success: false, error: "Not authenticated", mode: "local" };
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
      .where(and(eq(icons.project_id, id), eq(projects.user_id, session.user.id)));
    for (const icon of iconsResult) await bucket.delete(icon.svg_path);
    await db.delete(projects).where(and(eq(projects.id, id), eq(projects.user_id, session.user.id)));
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
  const localProjects = useStore<{ items: LocalProject[]; loaded: boolean }>({ items: [], loaded: false });
  const toasts = useStore<{ items: ToastItem[] }>({ items: [] });
  const toastId = useSignal(0);

  const showToast = $((message: string, type: ToastItem["type"] = "info") => {
    const id = ++toastId.value;
    toasts.items = [...toasts.items, { id, message, type }];
    setTimeout(() => { toasts.items = toasts.items.filter((t) => t.id !== id); }, 3000);
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (loaderData.value.mode === "local") {
      localProjects.items = getLocalProjects();
      localProjects.loaded = true;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => { document.title = "Iconfont - 我的项目"; });

  useOnDocument("keydown", $((ev: KeyboardEvent) => {
    const target = ev.target as HTMLElement;
    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
    if (ev.key === "Escape") { if (showModal.value) { showModal.value = false; return; } if (showShortcuts.value) { showShortcuts.value = false; return; } }
    if (ev.key === "?" && !ev.shiftKey) { showShortcuts.value = true; return; }
    if (ev.key === "/") { ev.preventDefault(); (document.querySelector('input[placeholder="搜索项目..."]') as HTMLInputElement)?.focus(); }
  }));

  const confirmState = useStore<{ show: boolean; project: any | null }>({ show: false, project: null });

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
    const timer = setTimeout(() => { debouncedQuery.value = searchQuery.value; }, 200);
    return () => clearTimeout(timer);
  });

  const activeProjects = () => loaderData.value.mode === "local" ? (localProjects.loaded ? localProjects.items : []) : loaderData.value.projects;

  const filtered = () => {
    const source = activeProjects();
    let list = debouncedQuery.value
      ? source.filter((p: any) => p.name.toLowerCase().includes(debouncedQuery.value.toLowerCase()) || (p.description || "").toLowerCase().includes(debouncedQuery.value.toLowerCase()))
      : [...source];
    if (sortProjects.value === "name") list = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name));
    else if (sortProjects.value === "count") list = [...list].sort((a: any, b: any) => (b.icon_count || 0) - (a.icon_count || 0));
    return list;
  };

  const handleDelete = $((project: any) => { confirmState.project = project; confirmState.show = true; });

  const handleCreate = $(async (ev: any) => {
    const fd = new FormData(ev.target);
    const name = fd.get("name") as string;
    const description = (fd.get("description") as string) || null;
    const font_family = (fd.get("font_family") as string) || "iconfont";
    const prefix = (fd.get("prefix") as string) || "icon-";
    if (loaderData.value.mode === "local") {
      const project = createLocalProject({ name, description: description || undefined, font_family, prefix });
      localProjects.items = getLocalProjects();
      showModal.value = false;
      showToast(`项目 "${name}" 创建成功`, "success");
      nav(`/project/${project.id}`);
    } else {
      const result = await createProject.submit({ name, description, font_family, prefix });
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
    <div class="min-h-screen bg-base-200">
      <ToastContainer toasts={toasts.items} />

      {/* ── Navbar ────────────────────────────────────────────── */}
      <header class="bg-base-100 border-base-300 sticky top-0 z-30 border-b">
        <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Left: Logo */}
          <a href="/" class="flex items-center gap-2.5">
            <div class="bg-primary text-primary-content flex h-8 w-8 items-center justify-center rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span class="text-base font-semibold tracking-tight">Iconfont</span>
            <span class="text-base-content/40 text-xs">开源版</span>
          </a>

          {/* Right: Actions */}
          <div class="flex items-center gap-2">
            {isLocal && (
              <span class="badge badge-warning badge-sm">本地模式</span>
            )}
            {isLocal ? (
              <a href="/login" class="btn btn-ghost btn-sm text-sm">登录</a>
            ) : (
              <UserMenu />
            )}
            <button class="btn btn-primary btn-sm gap-1.5" onClick$={() => (showModal.value = true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              新建项目
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main class="mx-auto max-w-6xl px-4 py-6">
        {/* Toolbar */}
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-baseline gap-2">
            <h1 class="text-lg font-semibold">我的项目</h1>
            <span class="text-base-content/50 text-sm">
              {projectList.length} 个项目 · {projectList.reduce((s: number, p: any) => s + (p.icon_count || 0), 0)} 个图标
            </span>
          </div>
          <div class="flex items-center gap-2">
            <select class="select select-bordered select-sm min-w-0" value={sortProjects.value} onChange$={(ev: any) => (sortProjects.value = ev.target.value)}>
              <option value="date">按时间</option>
              <option value="name">按名称</option>
              <option value="count">按图标数</option>
            </select>
            <div class="relative">
              <input type="text" class="input input-bordered input-sm w-52 pl-8" placeholder="搜索项目..." value={searchQuery.value} onInput$={(ev: any) => (searchQuery.value = ev.target.value)} />
              <svg class="text-base-content/30 absolute top-1/2 left-2.5 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {projectList.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-24">
            <div class="bg-base-300 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl">
              <svg class="text-base-content/20" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h2 class="mb-1 text-base font-medium">{debouncedQuery.value ? "未找到匹配的项目" : "还没有项目"}</h2>
            <p class="text-base-content/50 mb-5 text-sm">
              {debouncedQuery.value ? "尝试其他关键词" : isLocal ? "创建项目开始管理图标（数据保存在浏览器本地）" : "创建你的第一个图标库，开始管理和生成 iconfont"}
            </p>
            {!debouncedQuery.value && (
              <button class="btn btn-primary btn-sm gap-1.5" onClick$={() => (showModal.value = true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
                </svg>
                新建项目
              </button>
            )}
          </div>
        ) : (
          /* Project Grid */
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {createProject.isRunning && <SkeletonProjectCard />}
            {projectList.map((project: any, idx: number) => (
              <div key={project.id} class={`card-hover group animate-fade-in bg-base-100 border-base-300 rounded-xl border stagger-${(idx % 8) + 1} ${deleting.id === project.id ? "pointer-events-none opacity-50" : ""}`}>
                <div class="cursor-pointer p-5" onClick$={() => nav(`/project/${project.id}`)}>
                  <div class="mb-3 flex items-start justify-between">
                    <h2 class="text-base font-semibold leading-tight">
                      <HighlightText text={project.name} query={debouncedQuery.value} />
                    </h2>
                    <button
                      class="btn btn-ghost btn-xs text-base-content/30 hover:text-error -mr-1.5 -mt-1 opacity-0 transition-all group-hover:opacity-100"
                      onClick$={(ev: any) => { ev.stopPropagation(); handleDelete(project); }}
                      disabled={deleting.id === project.id}
                    >
                      {deleting.id === project.id ? <span class="loading loading-spinner loading-xs" /> : "删除"}
                    </button>
                  </div>
                  {project.description && (
                    <p class="text-base-content/50 mb-3 line-clamp-2 text-sm leading-relaxed">
                      <HighlightText text={project.description} query={debouncedQuery.value} />
                    </p>
                  )}
                  <div class="flex items-center gap-3 text-xs">
                    <span class="text-base-content/40">{project.icon_count ?? 0} 个图标</span>
                    <span class="text-base-content/20">·</span>
                    <span class="text-base-content/40 font-mono">{project.font_family}</span>
                    <span class="text-base-content/20">·</span>
                    <span class="text-base-content/40 font-mono">{project.prefix}</span>
                  </div>
                  <p class="text-base-content/30 mt-2.5 text-xs">
                    {new Date(project.updated_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Create Project Modal ──────────────────────────────── */}
      {showModal.value && (
        <div class="modal modal-open">
          <div class="modal-box animate-modal max-w-lg p-0">
            <div class="border-base-300 border-b px-6 py-4">
              <h3 class="text-base font-semibold">新建项目</h3>
              <p class="text-base-content/50 mt-0.5 text-sm">设置项目名称和配置，后续上传图标后用于代码生成。</p>
            </div>
            <form preventdefault:submit onSubmit$={handleCreate}>
              <div class="space-y-4 px-6 py-5">
                <div class="form-control">
                  <label class="label py-1"><span class="label-text text-sm font-medium">项目名称 *</span></label>
                  <input name="name" type="text" class="input input-bordered input-sm w-full" placeholder="例如: my-icons" required />
                </div>
                <div class="form-control">
                  <label class="label py-1"><span class="label-text text-sm font-medium">描述</span></label>
                  <textarea name="description" class="textarea textarea-bordered textarea-sm w-full" rows={2} placeholder="项目描述（可选）" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-control">
                    <label class="label py-1"><span class="label-text text-sm font-medium">Font Family</span></label>
                    <input name="font_family" type="text" class="input input-bordered input-sm w-full" value="iconfont" />
                  </div>
                  <div class="form-control">
                    <label class="label py-1"><span class="label-text text-sm font-medium">Class 前缀</span></label>
                    <input name="prefix" type="text" class="input input-bordered input-sm w-full" value="icon-" />
                  </div>
                </div>
                <div class="bg-info/5 text-info rounded-lg px-3 py-2 text-xs">
                  生成 class 时会得到类似 <span class="font-mono font-medium">icon-home</span> 的名称。
                </div>
              </div>
              <div class="border-base-300 flex justify-end gap-2 border-t px-6 py-3">
                <button type="button" class="btn btn-ghost btn-sm" onClick$={() => (showModal.value = false)}>取消</button>
                <button type="submit" class="btn btn-primary btn-sm">创建</button>
              </div>
            </form>
          </div>
          <div class="modal-backdrop" onClick$={() => (showModal.value = false)} />
        </div>
      )}

      {/* ── Confirm Delete Modal ──────────────────────────────── */}
      {confirmState.show && (
        <div class="modal modal-open">
          <div class="modal-box animate-modal max-w-sm">
            <h3 class="text-base font-semibold">确认删除</h3>
            <p class="text-base-content/60 mt-2 text-sm">
              确定要删除项目 "{confirmState.project?.name}" 吗？此操作将删除项目下的所有图标，不可恢复。
            </p>
            <div class="modal-action mt-4">
              <button class="btn btn-ghost btn-sm" onClick$={() => { confirmState.show = false; confirmState.project = null; }}>取消</button>
              <button class="btn btn-error btn-sm" onClick$={confirmDelete}>删除</button>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => { confirmState.show = false; confirmState.project = null; }} />
        </div>
      )}

      {/* ── Keyboard Shortcuts ─────────────────────────────────── */}
      {showShortcuts.value && (
        <div class="modal modal-open">
          <div class="modal-box animate-modal max-w-xs">
            <h3 class="mb-3 text-base font-semibold">键盘快捷键</h3>
            <div class="space-y-1.5 text-sm">
              {[["搜索聚焦", "/"], ["关闭弹窗", "Esc"], ["快捷键帮助", "?"]].map(([label, key]) => (
                <div class="flex items-center justify-between py-1" key={label}>
                  <span class="text-base-content/60">{label}</span>
                  <kbd class="kbd kbd-sm">{key}</kbd>
                </div>
              ))}
            </div>
            <div class="modal-action mt-3">
              <button class="btn btn-ghost btn-sm" onClick$={() => (showShortcuts.value = false)}>关闭</button>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => (showShortcuts.value = false)} />
        </div>
      )}
    </div>
  );
});

const UserMenu = component$(() => {
  const showMenu = useSignal(false);
  const nav = useNavigate();
  const handleSignOut = $(async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    nav("/");
  });
  return (
    <div class="dropdown dropdown-end">
      <label class="btn btn-ghost btn-sm btn-circle" onClick$={() => (showMenu.value = !showMenu.value)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      </label>
      {showMenu.value && (
        <ul class="menu dropdown-content bg-base-100 rounded-box z-10 w-36 p-1.5 shadow-lg">
          <li><button class="text-sm" onClick$={handleSignOut}>退出登录</button></li>
        </ul>
      )}
    </div>
  );
});
