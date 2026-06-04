import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  type QRL,
} from "@builder.io/qwik";
import { SvgPreview } from "~/components/svg-preview/svg-preview";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProjectEntry {
  id: number;
  name: string;
  iconCount: number;
  isLocal: boolean;
}

export interface AddToProjectIcon {
  id: number;
  name: string;
  content: string | null;
  unicode: string | null;
  view_box: string | null;
}

export interface AddToProjectDrawerProps {
  icon: AddToProjectIcon;
  userId: string | null;
  /** Direct QRL reference — used on backdrop/close button only (no closure) */
  onClose$: QRL<() => void>;
}

// ── Component ────────────────────────────────────────────────────────────────

export const AddToProjectDrawer = component$<AddToProjectDrawerProps>(
  ({ icon, userId, onClose$ }) => {
    // ── State ────────────────────────────────────────────────────
    type Step = "select" | "saving" | "done";
    const step = useSignal<Step>("select");

    const projects = useSignal<ProjectEntry[]>([]);
    const loading = useSignal(true);
    const selectedId = useSignal<number | null>(null);
    const iconName = useSignal(icon.name);
    const error = useSignal("");
    const savedToName = useSignal("");

    // Inline new-project form
    const creatingNew = useSignal(false);
    const newProjectName = useSignal("");
    const creatingLoading = useSignal(false);

    // ── Load projects ─────────────────────────────────────────────
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(async () => {
      if (userId) {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = (await res.json()) as {
            projects: { id: number; name: string; icon_count?: number }[];
          };
          const list: ProjectEntry[] = (data.projects ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            iconCount: p.icon_count ?? 0,
            isLocal: false,
          }));
          projects.value = list;
          if (list.length > 0) selectedId.value = list[0].id;
        }
      } else {
        // Anonymous — read from localStorage
        const { getLocalProjects } = await import("~/lib/local-storage");
        const local = getLocalProjects();
        const list: ProjectEntry[] = local.map((p) => ({
          id: p.id,
          name: p.name,
          iconCount: p.icon_count ?? 0,
          isLocal: true,
        }));
        projects.value = list;
        if (list.length > 0) selectedId.value = list[0].id;
      }
      loading.value = false;
    });

    // ── Save ──────────────────────────────────────────────────────
    const handleSave = $(async () => {
      const name = iconName.value.trim();
      if (!selectedId.value || !name) return;
      if (!icon.content) {
        error.value = "该图标暂无 SVG 内容，无法复制";
        return;
      }

      step.value = "saving";
      error.value = "";

      const target = projects.value.find((p) => p.id === selectedId.value);

      if (userId) {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("content", icon.content);
        if (icon.unicode) formData.append("unicode", icon.unicode);
        if (icon.view_box) formData.append("viewBox", icon.view_box);

        const res = await fetch(`/api/projects/${selectedId.value}/icons`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          error.value = data.error ?? "保存失败，请重试";
          step.value = "select";
          return;
        }
      } else {
        const { createLocalIcon } = await import("~/lib/local-storage");
        createLocalIcon(selectedId.value, {
          name,
          content: icon.content,
          unicode: icon.unicode ?? undefined,
        });
      }

      savedToName.value = target?.name ?? "项目";
      step.value = "done";
    });

    // ── Create project ────────────────────────────────────────────
    const handleCreateProject = $(async () => {
      const name = newProjectName.value.trim();
      if (!name) return;
      creatingLoading.value = true;

      if (userId) {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (res.ok) {
          const data = (await res.json()) as { id: number };
          const entry: ProjectEntry = {
            id: data.id,
            name,
            iconCount: 0,
            isLocal: false,
          };
          projects.value = [entry, ...projects.value];
          selectedId.value = data.id;
        }
      } else {
        const { createLocalProject } = await import("~/lib/local-storage");
        const proj = createLocalProject({ name });
        const entry: ProjectEntry = {
          id: proj.id,
          name: proj.name,
          iconCount: 0,
          isLocal: true,
        };
        projects.value = [entry, ...projects.value];
        selectedId.value = proj.id;
      }

      creatingLoading.value = false;
      creatingNew.value = false;
      newProjectName.value = "";
    });

    const canSave =
      !!selectedId.value &&
      !!iconName.value.trim() &&
      !!icon.content &&
      step.value !== "saving";

    // ── Render ────────────────────────────────────────────────────
    return (
      <div class="fixed inset-0 z-40 flex">
        {/* Backdrop — direct QRL, no closure */}
        <div class="flex-1 bg-black/30 backdrop-blur-sm" onClick$={onClose$} />

        {/* Drawer panel */}
        <div class="flex h-full w-full max-w-xs flex-col border-l border-[var(--color-base-300)] bg-[var(--color-base-100)] shadow-2xl sm:max-w-sm">
          {/* Header */}
          <div class="flex shrink-0 items-center justify-between border-b border-[var(--color-base-300)] px-5 py-4">
            <h2 class="text-base font-extrabold text-[var(--color-neutral)]">
              添加到项目
            </h2>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-base-400)] hover:bg-[var(--color-base-200)]"
              onClick$={onClose$}
            >
              ✕
            </button>
          </div>

          {/* Success state */}
          {step.value === "done" ? (
            <div class="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
              <div class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
                ✓
              </div>
              <div>
                <p class="text-lg font-extrabold text-[var(--color-neutral)]">
                  已添加！
                </p>
                <p class="mt-1 text-sm text-[var(--color-neutral)]">
                  已将「{iconName.value}」保存到「{savedToName.value}」
                </p>
              </div>
              <a
                href={`/project/${selectedId.value}`}
                class="bg-[var(--color-base-200)]0 rounded-md px-5 py-2 text-sm font-bold text-white hover:bg-rose-600"
              >
                查看项目 →
              </a>
              <button
                class="text-xs text-[var(--color-base-400)] hover:text-[var(--color-neutral)]"
                onClick$={() => {
                  step.value = "select";
                  savedToName.value = "";
                }}
              >
                继续添加到其他项目
              </button>
            </div>
          ) : (
            <div class="flex flex-1 flex-col overflow-hidden">
              {/* Icon preview + name input */}
              <div class="shrink-0 border-b border-[var(--color-base-200)] px-5 py-4">
                <div class="flex items-center gap-3">
                  <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-200)]">
                    {icon.content ? (
                      <SvgPreview
                        content={icon.content}
                        class="h-9 w-9"
                        color="#e11d48"
                      />
                    ) : (
                      <span class="text-[10px] text-[var(--color-base-400)]">
                        无预览
                      </span>
                    )}
                  </div>
                  <div class="min-w-0 flex-1">
                    <label class="mb-1 block text-[11px] font-semibold tracking-wide text-[var(--color-base-400)] uppercase">
                      图标名称
                    </label>
                    <input
                      type="text"
                      class="w-full rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-200)]/50 px-3 py-1.5 text-sm text-[var(--color-neutral)] focus:border-[var(--color-base-300)] focus:outline-none"
                      value={iconName.value}
                      onInput$={(e) =>
                        (iconName.value = (e.target as HTMLInputElement).value)
                      }
                    />
                  </div>
                </div>
                {!icon.content && (
                  <p class="mt-2 text-xs text-amber-600">
                    ⚠ 该图标暂无 SVG 内容，无法保存
                  </p>
                )}
              </div>

              {/* Project list */}
              <div class="flex-1 overflow-y-auto px-5 py-4">
                <div class="mb-3 flex items-center justify-between">
                  <p class="text-[11px] font-semibold tracking-wide text-[var(--color-base-400)] uppercase">
                    目标项目
                  </p>
                  <button
                    class="text-xs font-semibold text-[var(--color-neutral)] hover:text-[var(--color-neutral)]"
                    onClick$={() => {
                      creatingNew.value = !creatingNew.value;
                      newProjectName.value = "";
                    }}
                  >
                    {creatingNew.value ? "取消" : "+ 新建项目"}
                  </button>
                </div>

                {/* Inline new-project form */}
                {creatingNew.value && (
                  <div class="mb-3 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-200)] p-3">
                    <input
                      type="text"
                      placeholder="项目名称..."
                      class="mb-2 w-full rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-3 py-1.5 text-sm text-[var(--color-neutral)] focus:border-[var(--color-base-300)] focus:outline-none"
                      value={newProjectName.value}
                      onInput$={(e) =>
                        (newProjectName.value = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                    <button
                      class={[
                        "w-full rounded-md py-1.5 text-sm font-bold text-white transition-all",
                        newProjectName.value.trim()
                          ? "bg-[var(--color-base-200)]0 hover:bg-rose-600"
                          : "cursor-not-allowed bg-[var(--color-base-300)]",
                      ].join(" ")}
                      disabled={
                        !newProjectName.value.trim() || creatingLoading.value
                      }
                      onClick$={handleCreateProject}
                    >
                      {creatingLoading.value ? "创建中..." : "创建并选择"}
                    </button>
                  </div>
                )}

                {/* Project entries */}
                {loading.value ? (
                  <div class="flex justify-center py-8">
                    <div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-base-300)] border-t-rose-500" />
                  </div>
                ) : projects.value.length === 0 ? (
                  <div class="py-8 text-center">
                    <p class="text-sm text-[var(--color-base-400)]">暂无项目</p>
                    <p class="mt-1 text-xs text-[var(--color-base-400)]">
                      点击上方「+ 新建项目」开始
                    </p>
                  </div>
                ) : (
                  <div class="space-y-1.5">
                    {projects.value.map((p) => {
                      const isSelected = selectedId.value === p.id;
                      return (
                        <button
                          key={p.id}
                          class={[
                            "flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-all",
                            isSelected
                              ? "border-[var(--color-base-300)] bg-[var(--color-base-200)] ring-1 ring-[var(--color-base-300)]"
                              : "border-[var(--color-base-300)] bg-[var(--color-base-100)] hover:border-[var(--color-base-300)] hover:bg-[var(--color-base-200)]/50",
                          ].join(" ")}
                          onClick$={() => (selectedId.value = p.id)}
                        >
                          <div class="flex min-w-0 items-center gap-2.5">
                            <span
                              class={[
                                "h-4 w-4 shrink-0 rounded-full border-2 transition-all",
                                isSelected
                                  ? "border-[var(--color-base-200)]0 bg-[var(--color-base-200)]0"
                                  : "border-[var(--color-base-300)]",
                              ].join(" ")}
                            />
                            <span class="truncate text-sm font-medium text-[var(--color-neutral)]">
                              {p.name}
                            </span>
                            {p.isLocal && (
                              <span class="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                本地
                              </span>
                            )}
                          </div>
                          <span class="ml-2 shrink-0 text-xs text-[var(--color-base-400)]">
                            {p.iconCount} 个
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div class="shrink-0 border-t border-[var(--color-base-300)] px-5 py-4">
                {error.value && (
                  <p class="mb-2 text-xs text-red-600">{error.value}</p>
                )}
                <button
                  class={[
                    "w-full rounded-md py-2.5 text-sm font-bold text-white transition-all",
                    canSave
                      ? "bg-[var(--color-base-200)]0 hover:bg-rose-600 active:scale-[0.98]"
                      : "cursor-not-allowed bg-[var(--color-base-300)]",
                  ].join(" ")}
                  disabled={!canSave}
                  onClick$={handleSave}
                >
                  {step.value === "saving" ? "保存中..." : "保存到项目"}
                </button>
                {!userId && (
                  <p class="mt-2 text-center text-[11px] text-[var(--color-base-400)]">
                    未登录 — 图标将保存到本地临时项目
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);
