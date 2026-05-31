import { component$, useSignal, $, type QRL } from "@builder.io/qwik";
import { ICON_LIBRARIES, type IconLibrary } from "~/lib/github-registry";

// ── Types ────────────────────────────────────────────────────────────────────

interface IconItem {
  name: string;
  previewUrl: string;
}

export interface GithubImportProps {
  /** QRL called when the modal should close */
  onClose$: QRL<() => void>;
}

// ── Component ────────────────────────────────────────────────────────────────

export const GithubImport = component$<GithubImportProps>(({ onClose$ }) => {
  // ── Navigation state ──────────────────────────────────────────
  type Step = "library" | "browse" | "importing" | "done";
  const step = useSignal<Step>("library");

  // ── Library / variant selection ───────────────────────────────
  const selectedLibId = useSignal("");
  const selectedVariant = useSignal("");

  // Custom GitHub URL state
  const customUrlInput = useSignal("");
  const customUrlError = useSignal("");
  /** true when browsing a custom repo (not a curated library) */
  const isCustom = useSignal(false);
  /** raw URL stored for POST body when isCustom=true */
  const customGithubUrl = useSignal("");
  /** human-readable display name e.g. "lobehub/lobe-icons" */
  const customLabel = useSignal("");

  // ── Icon list + display ───────────────────────────────────────
  const iconList = useSignal<IconItem[]>([]);
  const loadingIcons = useSignal(false);
  const loadError = useSignal("");
  const search = useSignal("");
  const displayCount = useSignal(120);

  // ── Selection ─────────────────────────────────────────────────
  const selected = useSignal<string[]>([]);

  // ── Import config + result ────────────────────────────────────
  const projectName = useSignal("");
  const importedId = useSignal(0);
  const importedCount = useSignal(0);
  const importedFailed = useSignal(0);
  const importError = useSignal("");

  // ── Helper: load icon list from API ──────────────────────────
  const loadIcons$ = $(async (libId: string, variantId: string) => {
    loadingIcons.value = true;
    loadError.value = "";
    iconList.value = [];
    selected.value = [];
    displayCount.value = 120;

    try {
      const qs = variantId ? `&variant=${variantId}` : "";
      const res = await fetch(`/api/github-import?registry=${libId}${qs}`);
      const data = (await res.json()) as {
        icons?: IconItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "加载图标列表失败");
      iconList.value = data.icons ?? [];
    } catch (e: any) {
      loadError.value = e.message;
    } finally {
      loadingIcons.value = false;
    }
  });

  /** Load icons from an arbitrary GitHub tree URL */
  const loadIconsFromUrl$ = $(async (githubUrl: string) => {
    customUrlError.value = "";
    loadingIcons.value = true;
    loadError.value = "";
    iconList.value = [];
    selected.value = [];
    displayCount.value = 120;

    try {
      const res = await fetch(
        `/api/github-import?url=${encodeURIComponent(githubUrl)}`,
      );
      const data = (await res.json()) as {
        icons?: IconItem[];
        label?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      iconList.value = data.icons ?? [];
      // Update display label from server response (parsed from URL)
      if (data.label) customLabel.value = data.label;
    } catch (e: any) {
      loadError.value = e.message;
    } finally {
      loadingIcons.value = false;
    }
  });

  // ── Derived (computed inline — reruns on signal change) ───────
  const lib: IconLibrary | undefined = ICON_LIBRARIES.find(
    (l) => l.id === selectedLibId.value,
  );
  const q = search.value.toLowerCase().trim();
  const filteredIcons = q
    ? iconList.value.filter((ic) => ic.name.toLowerCase().includes(q))
    : iconList.value;
  const visibleIcons = filteredIcons.slice(0, displayCount.value);
  const allFilteredSelected =
    filteredIcons.length > 0 &&
    filteredIcons.every((ic) => selected.value.includes(ic.name));

  // ── Render ────────────────────────────────────────────────────
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop — clicking it closes the modal (direct QRL reference, no closure) */}
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick$={onClose$}
      />

      {/* Modal panel */}
      <div class="relative z-10 flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-2xl">
        {/* ── Header ──────────────────────────────────────────── */}
        <div class="flex shrink-0 items-center justify-between border-b border-rose-100 px-5 py-3.5">
          <div class="flex items-center gap-2.5">
            {/* Back button — only closes/resets local state (signals), no prop callback needed */}
            {step.value !== "library" && step.value !== "importing" && (
              <button
                class="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50"
                onClick$={() => {
                  step.value = "library";
                  iconList.value = [];
                  selected.value = [];
                  search.value = "";
                  importedId.value = 0;
                  isCustom.value = false;
                  customGithubUrl.value = "";
                  customLabel.value = "";
                  customUrlError.value = "";
                }}
              >
                ←
              </button>
            )}
            <div>
              <h2 class="font-['Nunito'] text-base leading-tight font-extrabold text-rose-950">
                {step.value === "library" && "GitHub 图标库导入"}
                {step.value === "browse" &&
                  (lib?.name ?? (isCustom.value ? customLabel.value || "自定义仓库" : "浏览图标"))}
                {step.value === "importing" && "正在导入..."}
                {step.value === "done" && "导入完成 ✓"}
              </h2>
              {step.value === "browse" && (
                <p class="text-[11px] text-rose-400">
                  {filteredIcons.length.toLocaleString()} 个图标
                  {selected.value.length > 0 &&
                    `，已选 ${selected.value.length} 个`}
                </p>
              )}
            </div>
          </div>
          {/* Close button — direct QRL reference, no closure */}
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-100"
            onClick$={onClose$}
          >
            ✕
          </button>
        </div>

        {/* ── Step: Library Selection ──────────────────────────── */}
        {step.value === "library" && (
          <div class="flex-1 overflow-y-auto p-5">
            <p class="mb-4 text-sm text-rose-500">
              选择一个开源图标库，预览后一键导入并创建公开图标集
            </p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ICON_LIBRARIES.map((l) => (
                <button
                  key={l.id}
                  class="group rounded-2xl border border-rose-100 bg-white p-4 text-left shadow-sm transition-all hover:border-rose-300 hover:shadow-md active:scale-[0.98]"
                  style={{ borderLeftColor: l.color, borderLeftWidth: "4px" }}
                  onClick$={async () => {
                    selectedLibId.value = l.id;
                    const defVariant =
                      l.defaultVariant ?? l.variants?.[0]?.id ?? "";
                    selectedVariant.value = defVariant;
                    projectName.value = l.name;
                    step.value = "browse";
                    await loadIcons$(l.id, defVariant);
                  }}
                >
                  <div class="mb-1.5 flex items-center justify-between">
                    <span class="font-['Nunito'] text-sm font-bold text-rose-950">
                      {l.name}
                    </span>
                    <span class="text-[10px] font-medium text-rose-300">
                      {l.license}
                    </span>
                  </div>
                  <p class="mb-3 text-xs leading-relaxed text-rose-500">
                    {l.description}
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      class="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: l.color }}
                    >
                      {l.iconCount.toLocaleString()}+ 图标
                    </span>
                    {l.variants && (
                      <span class="text-[11px] text-rose-400">
                        {l.variants.length} 种风格
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom GitHub repo URL input */}
            <div class="mt-4 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/30 p-4">
              <p class="mb-1 text-sm font-semibold text-rose-800">
                🔗 自定义 GitHub 仓库
              </p>
              <p class="mb-3 text-xs leading-relaxed text-rose-500">
                粘贴任意 GitHub 目录页面的 URL，导入其中的 SVG 图标
              </p>
              <div class="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://github.com/owner/repo/tree/branch/icons"
                  class="flex-1 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs text-rose-900 placeholder:text-rose-300 focus:border-rose-300 focus:outline-none"
                  value={customUrlInput.value}
                  onInput$={(e) => {
                    customUrlInput.value = (e.target as HTMLInputElement).value;
                    customUrlError.value = "";
                  }}
                />
                <button
                  class={[
                    "shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all",
                    customUrlInput.value.trim()
                      ? "bg-rose-500 hover:bg-rose-600 active:scale-95"
                      : "cursor-not-allowed bg-rose-200",
                  ].join(" ")}
                  disabled={!customUrlInput.value.trim() || loadingIcons.value}
                  onClick$={async () => {
                    const raw = customUrlInput.value.trim();
                    if (!raw) return;

                    // Basic validation: must look like a GitHub URL
                    if (!raw.includes("github.com")) {
                      customUrlError.value = "请输入有效的 GitHub URL";
                      return;
                    }

                    // Derive a display name from the URL
                    const parts = raw
                      .replace(/^https?:\/\/github\.com\//, "")
                      .split("/");
                    const label = parts.slice(0, 2).join("/");
                    const repoName = parts[1] || "imported-icons";

                    // Mark as custom mode
                    isCustom.value = true;
                    customGithubUrl.value = raw;
                    customLabel.value = label;
                    projectName.value = repoName;
                    step.value = "browse";

                    await loadIconsFromUrl$(raw);
                  }}
                >
                  {loadingIcons.value ? "加载中..." : "加载图标"}
                </button>
              </div>
              {customUrlError.value && (
                <p class="mt-1.5 text-xs text-red-600">{customUrlError.value}</p>
              )}
              <p class="mt-2 text-[10px] text-rose-300">
                示例： https://github.com/lobehub/lobe-icons/tree/master/packages/static-svg/icons
              </p>
            </div>
          </div>
        )}

        {/* ── Step: Browse & Select Icons ──────────────────────── */}
        {step.value === "browse" && (
          <>
            {/* Toolbar */}
            <div class="shrink-0 border-b border-rose-100 bg-rose-50/30 px-5 py-2.5">
              <div class="flex items-center gap-2">
                {/* Variant selector */}
                {lib?.variants && (
                  <select
                    class="shrink-0 rounded-xl border border-rose-100 bg-white px-2.5 py-1.5 text-xs text-rose-700 focus:outline-none"
                    value={selectedVariant.value}
                    onChange$={async (e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      selectedVariant.value = v;
                      selected.value = [];
                      search.value = "";
                      displayCount.value = 120;
                      await loadIcons$(selectedLibId.value, v);
                    }}
                  >
                    {lib.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                )}

                {/* Search */}
                <div class="relative flex-1">
                  <span class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[13px] text-rose-300">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="搜索图标名称..."
                    class="w-full rounded-xl border border-rose-100 bg-white py-1.5 pr-3 pl-7 text-sm text-rose-900 focus:border-rose-300 focus:outline-none"
                    value={search.value}
                    onInput$={(e) => {
                      search.value = (e.target as HTMLInputElement).value;
                      displayCount.value = 120;
                    }}
                  />
                </div>

                {/* Select / deselect all */}
                <button
                  class="shrink-0 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 active:scale-95"
                  onClick$={() => {
                    if (allFilteredSelected) {
                      const filteredSet = new Set(
                        filteredIcons.map((ic) => ic.name),
                      );
                      selected.value = selected.value.filter(
                        (n) => !filteredSet.has(n),
                      );
                    } else {
                      const filteredNames = filteredIcons.map((ic) => ic.name);
                      const merged = [
                        ...selected.value,
                        ...filteredNames.filter(
                          (n) => !selected.value.includes(n),
                        ),
                      ];
                      selected.value = merged.slice(0, 500);
                    }
                  }}
                >
                  {allFilteredSelected
                    ? "取消全选"
                    : `全选 (${Math.min(filteredIcons.length, 500)})`}
                </button>
              </div>

              {/* Contextual warnings */}
              {selected.value.length > 200 && selected.value.length < 500 && (
                <p class="mt-1.5 text-[11px] text-amber-600">
                  ⚠️ 已选 {selected.value.length} 个，大批量导入约需{" "}
                  {Math.ceil(selected.value.length / 10)} 秒
                </p>
              )}
              {selected.value.length >= 500 && (
                <p class="mt-1.5 text-[11px] text-red-600">
                  已达单次导入上限 500 个
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
                  <div class="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
                  <p class="text-sm text-rose-400">从 GitHub 加载图标列表...</p>
                </div>
              ) : iconList.value.length === 0 && !loadError.value ? (
                <div class="flex h-48 items-center justify-center">
                  <p class="text-sm text-rose-300">暂无图标</p>
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
                            "group relative flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-all",
                            isSel
                              ? "border-rose-400 bg-rose-50 ring-1 ring-rose-300"
                              : "border-transparent hover:border-rose-200 hover:bg-rose-50/60",
                          ].join(" ")}
                          onClick$={() => {
                            if (isSel) {
                              selected.value = selected.value.filter(
                                (n) => n !== icon.name,
                              );
                            } else if (selected.value.length < 500) {
                              selected.value = [...selected.value, icon.name];
                            }
                          }}
                        >
                          {isSel && (
                            <span class="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
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
                          <span class="w-full truncate text-center text-[9px] text-rose-400 group-hover:text-rose-600">
                            {icon.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {filteredIcons.length > displayCount.value && (
                    <div class="mt-4 text-center">
                      <button
                        class="rounded-2xl border border-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
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

            {/* Footer: project name + import button */}
            <div class="shrink-0 border-t border-rose-100 bg-white px-5 py-3.5">
              <div class="flex items-center gap-2.5">
                <input
                  type="text"
                  placeholder="图标集名称..."
                  class="flex-1 rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-2 text-sm text-rose-900 focus:border-rose-300 focus:outline-none"
                  value={projectName.value}
                  onInput$={(e) =>
                    (projectName.value = (e.target as HTMLInputElement).value)
                  }
                />
                <button
                  class={[
                    "shrink-0 rounded-2xl px-4 py-2 text-sm font-bold text-white transition-all",
                    selected.value.length > 0 && projectName.value.trim()
                      ? "bg-rose-500 hover:bg-rose-600 active:scale-95"
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
                        body: JSON.stringify(
                          isCustom.value
                            ? {
                                url: customGithubUrl.value,
                                icons: selected.value,
                                projectName: projectName.value.trim(),
                              }
                            : {
                                registry: selectedLibId.value,
                                variant: selectedVariant.value || undefined,
                                icons: selected.value,
                                projectName: projectName.value.trim(),
                              },
                        ),
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

        {/* ── Step: Importing (progress spinner) ──────────────── */}
        {step.value === "importing" && (
          <div class="flex flex-1 flex-col items-center justify-center gap-6 p-10">
            <div class="relative flex h-20 w-20 items-center justify-center">
              <div class="absolute inset-0 animate-spin rounded-full border-4 border-rose-100 border-t-rose-500" />
              <span class="text-2xl">🌐</span>
            </div>
            <div class="text-center">
              <p class="font-['Nunito'] text-xl font-extrabold text-rose-950">
                正在导入图标...
              </p>
              <p class="mt-2 text-sm text-rose-500">
                从 GitHub 下载 SVG 并写入数据库，请稍候
              </p>
              <p class="mt-1 text-xs text-rose-300">
                大批量导入可能需要 10–30 秒，请勿关闭此窗口
              </p>
            </div>
          </div>
        )}

        {/* ── Step: Done ───────────────────────────────────────── */}
        {step.value === "done" && (
          <div class="flex flex-1 flex-col items-center justify-center gap-6 p-10">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
              ✓
            </div>
            <div class="text-center">
              <p class="font-['Nunito'] text-2xl font-extrabold text-rose-950">
                导入成功！
              </p>
              <p class="mt-2 text-sm text-rose-500">
                成功导入{" "}
                <strong class="text-rose-700">{importedCount.value}</strong>{" "}
                个图标
                {importedFailed.value > 0 && (
                  <>，{importedFailed.value} 个下载失败</>
                )}
              </p>
            </div>
            <div class="flex items-center gap-3">
              {/* Native <a> navigation — no callback QRL needed */}
              <a
                href={`/project/${importedId.value}`}
                class="rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-600"
              >
                查看图标集 →
              </a>
              <button
                class="rounded-2xl border border-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick$={() => {
                  step.value = "library";
                  selectedLibId.value = "";
                  selectedVariant.value = "";
                  iconList.value = [];
                  selected.value = [];
                  search.value = "";
                  projectName.value = "";
                  importedId.value = 0;
                }}
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
