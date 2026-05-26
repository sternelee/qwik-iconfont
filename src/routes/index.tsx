import { component$, useSignal, $, useStore, useTask$, useOnDocument, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, useNavigate } from "@builder.io/qwik-city";
import type { Project } from "~/lib/types";
import { ToastContainer, type ToastItem } from "~/components/toast/toast";
import { SkeletonProjectCard } from "~/components/skeleton/skeleton";
import { HighlightText } from "~/components/highlight-text/highlight-text";

export const useProjects = routeLoader$(async ({ platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db);
  const stmt = db.prepare(`
    SELECT p.*, COUNT(i.id) as icon_count
    FROM projects p
    LEFT JOIN icons i ON p.id = i.project_id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `);
  const result = await stmt.all<Project & { icon_count: number }>();
  return result.results ?? [];
});

export const useCreateProject = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db);
  const stmt = db.prepare(
    "INSERT INTO projects (name, description, font_family, prefix) VALUES (?, ?, ?, ?)"
  );
  stmt.bind(data.name, data.description ?? null, data.font_family ?? "iconfont", data.prefix ?? "icon-");
  const result = await stmt.run();
  return { success: result.success, id: result.meta?.last_row_id };
});

export const useDeleteProject = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const { getBucket } = await import("~/lib/storage");
  const db = getDB(platform);
  await initDB(db);
  const bucket = getBucket(platform);
  const id = parseInt(data.id as string, 10);

  // Delete associated SVGs
  const iconsStmt = db.prepare("SELECT svg_path FROM icons WHERE project_id = ?").bind(id);
  const icons = await iconsStmt.all<{ svg_path: string }>();
  for (const icon of icons.results ?? []) {
    await bucket.delete(icon.svg_path);
  }

  const stmt = db.prepare("DELETE FROM projects WHERE id = ?").bind(id);
  await stmt.run();
  return { success: true };
});

export default component$(() => {
  const projects = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const nav = useNavigate();
  const showModal = useSignal(false);
  const searchQuery = useSignal("");
  const debouncedQuery = useSignal("");
  const deleting = useStore({ id: 0 });
  const showShortcuts = useSignal(false);

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
  useOnDocument("keydown", $((ev: KeyboardEvent) => {
    const target = ev.target as HTMLElement;
    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

    if (ev.key === "Escape") {
      if (showModal.value) { showModal.value = false; return; }
      if (showShortcuts.value) { showShortcuts.value = false; return; }
    }

    if (ev.key === "?" && !ev.shiftKey) {
      showShortcuts.value = true;
      return;
    }

    if (ev.key === "/") {
      // eslint-disable-next-line qwik/no-async-prevent-default
      ev.preventDefault();
      const searchInput = document.querySelector('input[placeholder="搜索项目..."]') as HTMLInputElement;
      searchInput?.focus();
    }
  }));

  // Confirm dialog state
  const confirmState = useStore<{ show: boolean; project: Project | null }>({ show: false, project: null });
  const confirmDelete = $(async () => {
    const project = confirmState.project;
    if (!project) return;
    confirmState.show = false;
    deleting.id = project.id;
    await deleteProject.submit({ id: String(project.id) });
    deleting.id = 0;
    showToast(`项目 "${project.name}" 已删除`, "success");
    nav("/", { replaceState: true });
  });

  // Debounce search
  useTask$(({ track }) => {
    track(() => searchQuery.value);
    const timer = setTimeout(() => {
      debouncedQuery.value = searchQuery.value;
    }, 200);
    return () => clearTimeout(timer);
  });

  const filtered = () => {
    if (!debouncedQuery.value) return projects.value;
    const q = debouncedQuery.value.toLowerCase();
    return projects.value.filter((p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
  };

  const handleDelete = $((project: Project) => {
    confirmState.project = project;
    confirmState.show = true;
  });

  return (
    <div class="min-h-screen bg-base-200">
      <ToastContainer toasts={toasts.items} />

      {/* Header */}
      <div class="navbar bg-base-100 shadow-sm px-4">
        <div class="flex-1 flex items-center gap-3">
          <svg class="text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <span class="text-xl font-bold">Iconfont</span>
          <span class="badge badge-sm badge-ghost">开源版</span>
        </div>
        <div class="flex-none gap-2">
          <button class="btn btn-primary btn-sm gap-1" onClick$={() => (showModal.value = true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            新建项目
          </button>
        </div>
      </div>

      {/* Main */}
      <div class="container mx-auto px-4 py-8">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 class="text-2xl font-bold">我的项目</h1>
          <div class="relative w-full sm:w-auto sm:min-w-[280px]">
            <input
              type="text"
              class="input input-bordered input-sm w-full pl-9"
              placeholder="搜索项目..."
              value={searchQuery.value}
              onInput$={(ev: any) => searchQuery.value = ev.target.value}
            />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
            </svg>
          </div>
        </div>

        {filtered().length === 0 ? (
          <div class="card bg-base-100 shadow">
            <div class="card-body items-center text-center py-16">
              <svg class="text-gray-300 mb-4" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <h2 class="card-title text-lg">{debouncedQuery.value ? "未找到匹配的项目" : "还没有项目"}</h2>
              <p class="text-gray-500 mb-4">{debouncedQuery.value ? "尝试其他关键词" : "创建你的第一个图标库，开始管理和生成 iconfont"}</p>
              {!debouncedQuery.value && (
                <button class="btn btn-primary btn-sm gap-1" onClick$={() => showModal.value = true}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                  新建项目
                </button>
              )}
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Skeleton cards shown while creating a project */}
            {createProject.isRunning && (
              <>
                <SkeletonProjectCard />
              </>
            )}
            {filtered().map((project) => (
              <div
                key={project.id}
                class={`card bg-base-100 shadow hover:shadow-lg transition-shadow group ${deleting.id === project.id ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div class="card-body cursor-pointer" onClick$={() => nav(`/project/${project.id}`)}>
                  <div class="flex items-start justify-between">
                    <h2 class="card-title text-lg">
                      <HighlightText text={project.name} query={debouncedQuery.value} />
                    </h2>
                    <button
                      class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity text-error"
                      onClick$={(ev: any) => { ev.stopPropagation(); handleDelete(project); }}
                      disabled={deleting.id === project.id}
                    >
                      {deleting.id === project.id ? (
                        <span class="loading loading-spinner loading-xs" />
                      ) : "删除"}
                    </button>
                  </div>
                  {project.description && (
                    <p class="text-sm text-gray-500 line-clamp-2">
                      <HighlightText text={project.description} query={debouncedQuery.value} />
                    </p>
                  )}
                  <div class="flex flex-wrap gap-2 mt-2">
                    <span class="badge badge-outline badge-sm">{project.icon_count ?? 0} 个图标</span>
                    <span class="badge badge-outline badge-sm">Font: {project.font_family}</span>
                    <span class="badge badge-outline badge-sm">Prefix: {project.prefix}</span>
                  </div>
                  <p class="text-xs text-gray-400 mt-2">更新于 {new Date(project.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showModal.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-lg">
            <h3 class="font-bold text-lg mb-4">新建项目</h3>
            <form
              onSubmit$={async (ev: any) => {
                ev.preventDefault();
                const fd = new FormData(ev.target);
                const result = await createProject.submit({
                  name: fd.get("name"),
                  description: fd.get("description"),
                  font_family: fd.get("font_family"),
                  prefix: fd.get("prefix"),
                });
                showModal.value = false;
                if (result.value.success) {
                  showToast(`项目 "${fd.get("name")}" 创建成功`, "success");
                } else {
                  showToast("项目创建失败", "error");
                }
                nav("/", { replaceState: true });
              }}
            >
              <div class="form-control mb-3">
                <label class="label"><span class="label-text">项目名称 *</span></label>
                <input name="name" type="text" class="input input-bordered" placeholder="例如: my-icons" required />
              </div>
              <div class="form-control mb-3">
                <label class="label"><span class="label-text">描述</span></label>
                <input name="description" type="text" class="input input-bordered" placeholder="项目描述（可选）" />
              </div>
              <div class="form-control mb-3">
                <label class="label"><span class="label-text">Font Family</span></label>
                <input name="font_family" type="text" class="input input-bordered" placeholder="iconfont" value="iconfont" />
              </div>
              <div class="form-control mb-4">
                <label class="label"><span class="label-text">Class 前缀</span></label>
                <input name="prefix" type="text" class="input input-bordered" placeholder="icon-" value="icon-" />
              </div>
              <div class="modal-action">
                <button type="button" class="btn" onClick$={() => (showModal.value = false)}>取消</button>
                <button type="submit" class="btn btn-primary">创建</button>
              </div>
            </form>
          </div>
          <div class="modal-backdrop" onClick$={() => (showModal.value = false)} />
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmState.show && (
        <div class="modal modal-open">
          <div class="modal-box max-w-sm">
            <h3 class="font-bold text-lg mb-2">确认删除</h3>
            <p class="text-gray-500 mb-4">
              确定要删除项目 "{confirmState.project?.name}" 吗？此操作将删除项目下的所有图标，不可恢复。
            </p>
            <div class="modal-action">
              <button class="btn" onClick$={() => { confirmState.show = false; confirmState.project = null; }}>取消</button>
              <button class="btn btn-error" onClick$={confirmDelete}>删除</button>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => { confirmState.show = false; confirmState.project = null; }} />
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcuts.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-md">
            <h3 class="font-bold text-lg mb-4">键盘快捷键</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between items-center py-1 border-b border-base-200">
                <span>搜索聚焦</span>
                <kbd class="kbd kbd-sm">/</kbd>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-base-200">
                <span>关闭弹窗</span>
                <kbd class="kbd kbd-sm">Esc</kbd>
              </div>
              <div class="flex justify-between items-center py-1">
                <span>显示快捷键帮助</span>
                <kbd class="kbd kbd-sm">?</kbd>
              </div>
            </div>
            <div class="modal-action">
              <button class="btn btn-sm" onClick$={() => showShortcuts.value = false}>关闭</button>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => showShortcuts.value = false} />
        </div>
      )}
    </div>
  );
});
