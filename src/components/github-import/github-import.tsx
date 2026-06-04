import { component$, useSignal, $, type QRL } from "@builder.io/qwik";

// ── Types ────────────────────────────────────────────────────────────────────

interface IconItem {
  name: string;
  previewUrl: string;
}

export interface GithubImportProps {
  onClose$: QRL<() => void>;
}

// ── Component ────────────────────────────────────────────────────────────────

export const GithubImport = component$<GithubImportProps>(({ onClose$ }) => {
  type Step = "input" | "browse" | "importing" | "done";
  const step = useSignal<Step>("input");

  // URL input
  const urlInput = useSignal("");
  const urlError = useSignal("");
  const githubUrl = useSignal(""); // confirmed URL for browse/import
  const repoLabel = useSignal(""); // display name e.g. "lobehub/lobe-icons"

  // Icon list + display
  const iconList = useSignal<IconItem[]>([]);
  const loadingIcons = useSignal(false);
  const loadError = useSignal("");
  const search = useSignal("");
  const displayCount = useSignal(120);

  // Selection
  const selected = useSignal<string[]>([]);

  // Import config + result
  const projectName = useSignal("");
  const importedId = useSignal(0);
  const importedCount = useSignal(0);
  const importedFailed = useSignal(0);
  const importError = useSignal("");

  // Load icons from a GitHub tree URL
  const loadIconsFromUrl$ = $(async (url: string) => {
    urlError.value = "";
    loadError.value = "";
    loadingIcons.value = true;
    iconList.value = [];
    selected.value = [];
    displayCount.value = 120;

    try {
      const res = await fetch(
        `/api/github-import?url=${encodeURIComponent(url)}`,
      );
      const data = (await res.json()) as {
        icons?: IconItem[];
        label?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      iconList.value = data.icons ?? [];
      if (data.label) repoLabel.value = data.label;
    } catch (e: any) {
      loadError.value = e.message;
    } finally {
      loadingIcons.value = false;
    }
  });

  // Derived
  const q = search.value.toLowerCase().trim();
  const filteredIcons = q
    ? iconList.value.filter((ic) => ic.name.toLowerCase().includes(q))
    : iconList.value;
  const visibleIcons = filteredIcons.slice(0, displayCount.value);
  const allSelected =
    filteredIcons.length > 0 &&
    filteredIcons.every((ic) => selected.value.includes(ic.name));
  const showDeselect = allSelected;

  const resetToInput = $(() => {
    step.value = "input";
    urlInput.value = "";
    urlError.value = "";
    githubUrl.value = "";
    repoLabel.value = "";
    iconList.value = [];
    selected.value = [];
    search.value = "";
    projectName.value = "";
    importedId.value = 0;
  });

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick$={onClose$}
      />

      {/* Modal */}
      <div class="relative z-10 flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--color-base-300)] bg-[var(--color-base-100)]">
        {/* Header */}
        <div class="flex shrink-0 items-center justify-between border-b border-[var(--color-base-300)] px-5 py-3.5">
          <div class="flex items-center gap-2.5">
            {step.value === "browse" && (
              <button
                class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-base-400)] hover:bg-[var(--color-base-200)]"
                onClick$={resetToInput}
              >
                ←
              </button>
            )}
            <div>
              <h2 class="text-base leading-tight font-extrabold text-[var(--color-neutral)]">
                {step.value === "input" && "从 GitHub 导入图标"}
                {step.value === "browse" && (repoLabel.value || "浏览图标")}
                {step.value === "importing" && "正在导入..."}
                {step.value === "done" && "导入完成 ✓"}
              </h2>
              {step.value === "browse" && (
                <p class="text-[11px] text-[var(--color-base-400)]">
                  {filteredIcons.length.toLocaleString()} 个图标
                  {selected.value.length > 0 &&
                    `，已选 ${selected.value.length} 个`}
                </p>
              )}
            </div>
          </div>
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-base-400)] hover:bg-[var(--color-base-300)]"
            onClick$={onClose$}
          >
            ✕
          </button>
        </div>

        {/* Step: input */}
        {step.value === "input" && (
          <div class="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div class="w-full max-w-lg">
              {/* Icon */}
              <div class="mb-5 flex justify-center">
                <div class="flex h-14 w-14 items-center justify-center rounded-md bg-[var(--color-base-200)] text-2xl">
                  🌐
                </div>
              </div>

              <h3 class="mb-1.5 text-center text-lg font-extrabold text-[var(--color-neutral)]">
                粘贴 GitHub 目录 URL
              </h3>
              <p class="mb-6 text-center text-sm text-[var(--color-base-400)]">
                支持任意 GitHub 仓库中的 SVG 图标目录
              </p>

              {/* URL input */}
              <div class="flex gap-2">
                <input
                  type="url"
                  placeholder="https://github.com/owner/repo/tree/branch/icons"
                  class="flex-1 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-200)]/50 px-4 py-2.5 text-sm text-[var(--color-neutral)] placeholder:text-[var(--color-base-400)] focus:border-[var(--color-base-300)] focus:outline-none"
                  value={urlInput.value}
                  onInput$={(e) => {
                    urlInput.value = (e.target as HTMLInputElement).value;
                    urlError.value = "";
                  }}
                  onKeyDown$={(e) => {
                    if (e.key === "Enter") {
                      const raw = urlInput.value.trim();
                      if (!raw) return;
                      if (!raw.includes("github.com")) {
                        urlError.value = "请输入有效的 GitHub URL";
                        return;
                      }
                      const parts = raw
                        .replace(/^https?:\/\/github\.com\//, "")
                        .split("/");
                      repoLabel.value = parts.slice(0, 2).join("/");
                      projectName.value = parts[1] || "imported-icons";
                      githubUrl.value = raw;
                      step.value = "browse";
                      loadIconsFromUrl$(raw);
                    }
                  }}
                />
                <button
                  class={[
                    "shrink-0 rounded-md px-5 py-2.5 text-sm font-bold text-white transition-all",
                    urlInput.value.trim()
                      ? "bg-[var(--color-base-200)]0 hover:bg-rose-600 active:scale-95"
                      : "cursor-not-allowed bg-rose-200",
                  ].join(" ")}
                  disabled={!urlInput.value.trim() || loadingIcons.value}
                  onClick$={async () => {
                    const raw = urlInput.value.trim();
                    if (!raw) return;
                    if (!raw.includes("github.com")) {
                      urlError.value = "请输入有效的 GitHub URL";
                      return;
                    }
                    const parts = raw
                      .replace(/^https?:\/\/github\.com\//, "")
                      .split("/");
                    repoLabel.value = parts.slice(0, 2).join("/");
                    projectName.value = parts[1] || "imported-icons";
                    githubUrl.value = raw;
                    step.value = "browse";
                    await loadIconsFromUrl$(raw);
                  }}
                >
                  {loadingIcons.value ? "加载中..." : "加载图标"}
                </button>
              </div>

              {urlError.value && (
                <p class="mt-2 text-xs text-red-500">{urlError.value}</p>
              )}

              {/* Example */}
              <div class="mt-4 rounded-md bg-[var(--color-base-200)] px-4 py-3">
                <p class="mb-1 text-xs font-semibold text-[var(--color-neutral)]">
                  示例
                </p>
                <button
                  class="w-full text-left font-mono text-xs break-all text-[var(--color-base-400)] hover:text-[var(--color-neutral)]"
                  onClick$={() => {
                    urlInput.value =
                      "https://github.com/lucide-icons/lucide/tree/main/icons";
                    urlError.value = "";
                  }}
                >
                  https://github.com/lucide-icons/lucide/tree/main/icons
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: browse */}
        {step.value === "browse" && (
          <>
            {/* Toolbar */}
            <div class="shrink-0 border-b border-[var(--color-base-300)] bg-[var(--color-base-200)]/30 px-5 py-2.5">
              <div class="flex items-center gap-2">
                <div class="relative flex-1">
                  <span class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[13px] text-[var(--color-base-400)]">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="搜索图标名称..."
                    class="w-full rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] py-1.5 pr-3 pl-7 text-sm text-[var(--color-neutral)] focus:border-[var(--color-base-300)] focus:outline-none"
                    value={search.value}
                    onInput$={(e) => {
                      search.value = (e.target as HTMLInputElement).value;
                      displayCount.value = 120;
                    }}
                  />
                </div>
                <button
                  class="shrink-0 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-neutral)] hover:bg-[var(--color-base-200)] active:scale-95"
                  onClick$={() => {
                    if (showDeselect) {
                      const filteredSet = new Set(
                        filteredIcons.map((ic) => ic.name),
                      );
                      selected.value = selected.value.filter(
                        (n) => !filteredSet.has(n),
                      );
                    } else {
                      const names = filteredIcons.map((ic) => ic.name);
                      selected.value = [
                        ...selected.value,
                        ...names.filter((n) => !selected.value.includes(n)),
                      ];
                    }
                  }}
                >
                  {showDeselect
                    ? "取消全选"
                    : `全选 (${filteredIcons.length.toLocaleString()})`}
                </button>
              </div>
              {selected.value.length > 200 && (
                <p class="mt-1.5 text-[11px] text-amber-600">
                  ⚠️ 已选 {selected.value.length.toLocaleString()} 个，导入约需{" "}
                  {Math.ceil(selected.value.length / 10)} 秒
                </p>
              )}
              {loadError.value && (
                <p class="mt-1.5 text-[11px] text-red-600">{loadError.value}</p>
              )}
            </div>

            {/* Icon grid */}
            <div class="flex-1 overflow-y-auto p-3">
              {loadingIcons.value ? (
                <div class="flex h-48 flex-col items-center justify-center gap-3">
                  <div class="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-base-300)] border-t-rose-500" />
                  <p class="text-sm text-[var(--color-base-400)]">
                    从 GitHub 加载图标列表...
                  </p>
                </div>
              ) : iconList.value.length === 0 && !loadError.value ? (
                <div class="flex h-48 items-center justify-center">
                  <p class="text-sm text-[var(--color-base-400)]">暂无图标</p>
                </div>
              ) : (
                <>
                  <div class="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                    {visibleIcons.map((icon) => {
                      const isSel = selected.value.includes(icon.name);
                      return (
                        <button
                          key={icon.name}
                          title={icon.name}
                          class={[
                            "group relative flex flex-col items-center gap-1 rounded-md border p-1.5 transition-all",
                            isSel
                              ? "border-[var(--color-base-300)] bg-[var(--color-base-200)] ring-1 ring-[var(--color-base-300)]"
                              : "border-transparent hover:border-[var(--color-base-300)] hover:bg-[var(--color-base-200)]/60",
                          ].join(" ")}
                          onClick$={() => {
                            if (isSel) {
                              selected.value = selected.value.filter(
                                (n) => n !== icon.name,
                              );
                            } else {
                              selected.value = [...selected.value, icon.name];
                            }
                          }}
                        >
                          {isSel && (
                            <span class="bg-[var(--color-base-200)]0 absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white">
                              ✓
                            </span>
                          )}
                          <img
                            src={icon.previewUrl}
                            alt={icon.name}
                            width={32}
                            height={32}
                            class="h-8 w-8 object-contain"
                            loading="lazy"
                          />
                          <span class="w-full truncate text-center text-[9px] text-[var(--color-base-400)] group-hover:text-[var(--color-neutral)]">
                            {icon.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {filteredIcons.length > displayCount.value && (
                    <div class="mt-4 text-center">
                      <button
                        class="rounded-md border border-[var(--color-base-300)] px-4 py-1.5 text-xs font-semibold text-[var(--color-neutral)] hover:bg-[var(--color-base-200)]"
                        onClick$={() => (displayCount.value += 120)}
                      >
                        加载更多（还有{" "}
                        {filteredIcons.length - displayCount.value} 个）
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div class="shrink-0 border-t border-[var(--color-base-300)] bg-[var(--color-base-100)] px-5 py-3.5">
              <div class="flex items-center gap-2.5">
                <input
                  type="text"
                  placeholder="图标集名称..."
                  class="flex-1 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-200)]/50 px-4 py-2 text-sm text-[var(--color-neutral)] focus:border-[var(--color-base-300)] focus:outline-none"
                  value={projectName.value}
                  onInput$={(e) =>
                    (projectName.value = (e.target as HTMLInputElement).value)
                  }
                />
                <button
                  class={[
                    "shrink-0 rounded-md px-4 py-2 text-sm font-bold text-white transition-all",
                    selected.value.length > 0 && projectName.value.trim()
                      ? "bg-[var(--color-base-200)]0 hover:bg-rose-600 active:scale-95"
                      : "cursor-not-allowed bg-rose-200",
                  ].join(" ")}
                  disabled={
                    selected.value.length === 0 ||
                    !projectName.value.trim() ||
                    loadingIcons.value
                  }
                  onClick$={async () => {
                    if (
                      !projectName.value.trim() ||
                      selected.value.length === 0
                    )
                      return;

                    step.value = "importing";
                    importError.value = "";

                    try {
                      const res = await fetch("/api/github-import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          url: githubUrl.value,
                          icons: selected.value,
                          projectName: projectName.value.trim(),
                        }),
                      });
                      const data = (await res.json()) as {
                        projectId?: number;
                        imported?: number;
                        failed?: number;
                        error?: string;
                      };
                      if (!res.ok)
                        throw new Error(data.error ?? "导入失败，请重试");

                      importedId.value = data.projectId ?? 0;
                      importedCount.value = data.imported ?? 0;
                      importedFailed.value = data.failed ?? 0;
                      step.value = "done";
                    } catch (e: any) {
                      importError.value = e.message;
                      step.value = "browse";
                    }
                  }}
                >
                  导入
                  {selected.value.length > 0
                    ? ` ${selected.value.length} 个`
                    : ""}
                </button>
              </div>
              {importError.value && (
                <p class="mt-1.5 text-xs text-red-600">{importError.value}</p>
              )}
            </div>
          </>
        )}

        {/* Step: importing */}
        {step.value === "importing" && (
          <div class="flex flex-1 flex-col items-center justify-center gap-6 p-10">
            <div class="relative flex h-20 w-20 items-center justify-center">
              <div class="absolute inset-0 animate-spin rounded-full border-4 border-[var(--color-base-300)] border-t-rose-500" />
              <span class="text-2xl">🌐</span>
            </div>
            <div class="text-center">
              <p class="text-xl font-extrabold text-[var(--color-neutral)]">
                正在导入图标...
              </p>
              <p class="mt-2 text-sm text-[var(--color-neutral)]">
                从 GitHub 下载 SVG 并写入数据库，请稍候
              </p>
              <p class="mt-1 text-xs text-[var(--color-base-400)]">
                大批量导入可能需要 10–30 秒，请勿关闭此窗口
              </p>
            </div>
          </div>
        )}

        {/* Step: done */}
        {step.value === "done" && (
          <div class="flex flex-1 flex-col items-center justify-center gap-6 p-10">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
              ✓
            </div>
            <div class="text-center">
              <p class="text-2xl font-extrabold text-[var(--color-neutral)]">
                导入成功！
              </p>
              <p class="mt-2 text-sm text-[var(--color-neutral)]">
                成功导入{" "}
                <strong class="text-[var(--color-neutral)]">
                  {importedCount.value}
                </strong>{" "}
                个图标
                {importedFailed.value > 0 && (
                  <>，{importedFailed.value} 个下载失败</>
                )}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <a
                href={`/project/${importedId.value}`}
                class="bg-[var(--color-base-200)]0 rounded-md px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-600"
              >
                查看图标集 →
              </a>
              <button
                class="rounded-md border border-[var(--color-base-300)] px-4 py-2.5 text-sm font-semibold text-[var(--color-neutral)] hover:bg-[var(--color-base-200)]"
                onClick$={resetToInput}
              >
                再导入一个
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
