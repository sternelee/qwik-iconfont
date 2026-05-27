import {
  component$,
  useSignal,
  $,
  useStore,
  useTask$,
  useComputed$,
  useOnDocument,
  useVisibleTask$,
} from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  useLocation,
  useNavigate,
} from "@builder.io/qwik-city";
import type { Project, Icon } from "~/lib/types";
import {
  generateTTFFont,
  generateCSS,
  generateSymbolSVG,
  generateDemoHTML,
} from "~/lib/font-gen";
import { SvgPreview } from "~/components/svg-preview/svg-preview";
import { ToastContainer, type ToastItem } from "~/components/toast/toast";
import { SkeletonIconCard } from "~/components/skeleton/skeleton";
import { HighlightText } from "~/components/highlight-text/highlight-text";

export const useProject = routeLoader$(async ({ params, platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db, platform);
  const { projects, icons } = await import("~/lib/schema");
  const { eq } = await import("drizzle-orm");
  const id = parseInt(params.id, 10);

  const projectResult = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));
  const project = projectResult[0] as Project | undefined;
  if (!project) throw new Error("Project not found");

  const iconsResult = await db
    .select()
    .from(icons)
    .where(eq(icons.project_id, id))
    .orderBy(icons.created_at);

  return { project, icons: iconsResult as Icon[] };
});

export const useDeleteIcon = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const { getBucket } = await import("~/lib/storage");
  const db = getDB(platform);
  await initDB(db, platform);
  const { icons } = await import("~/lib/schema");
  const { eq } = await import("drizzle-orm");
  const bucket = getBucket(platform);
  const id = parseInt(data.id as string, 10);

  const result = await db
    .select({ svg_path: icons.svg_path })
    .from(icons)
    .where(eq(icons.id, id));
  const current = result[0];

  if (current) await bucket.delete(current.svg_path);

  await db.delete(icons).where(eq(icons.id, id));
  return { success: true };
});

export const useUpdateProject = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db, platform);
  const { projects } = await import("~/lib/schema");
  const { eq } = await import("drizzle-orm");
  const id = parseInt(data.id as string, 10);

  await db
    .update(projects)
    .set({
      name: data.name as string,
      description: (data.description as string | undefined) ?? null,
      font_family: (data.font_family as string | undefined) ?? "iconfont",
      prefix: (data.prefix as string | undefined) ?? "icon-",
      updated_at: new Date().toISOString(),
    })
    .where(eq(projects.id, id));

  return { success: true };
});

export const useUpdateIcon = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const { uploadSVG } = await import("~/lib/storage");
  const db = getDB(platform);
  await initDB(db, platform);
  const { icons } = await import("~/lib/schema");
  const { eq } = await import("drizzle-orm");
  const id = parseInt(data.id as string, 10);

  const result = await db.select().from(icons).where(eq(icons.id, id));
  const current = result[0] as Icon | undefined;
  if (!current) return { success: false, error: "Icon not found" };

  let svgPath = current.svg_path;
  const name = (data.name as string) || current.name;
  const content = data.content as string | undefined;

  if (content && content !== current.content) {
    const cleanName = name
      .replace(/\.svg$/i, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-");
    svgPath = await uploadSVG(platform, current.project_id, cleanName, content);
  }

  await db
    .update(icons)
    .set({
      name,
      unicode: (data.unicode as string | undefined) ?? null,
      view_box: (data.view_box as string | undefined) ?? "0 0 1024 1024",
      content: content ?? current.content,
      svg_path: svgPath,
      updated_at: new Date().toISOString(),
    })
    .where(eq(icons.id, id));

  return { success: true };
});

export const useBatchRenameIcons = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db, platform);
  const { icons } = await import("~/lib/schema");
  const { eq, inArray } = await import("drizzle-orm");

  const ids = (data.ids as string).split(",").map((id) => parseInt(id, 10));
  const prefix = (data.prefix as string) || "";
  const suffix = (data.suffix as string) || "";
  const find = (data.find as string) || "";
  const replace = (data.replace as string) || "";

  const iconsResult = await db
    .select()
    .from(icons)
    .where(inArray(icons.id, ids));

  for (const icon of iconsResult) {
    let newName = icon.name;
    if (find) {
      newName = newName.split(find).join(replace);
    }
    newName = prefix + newName + suffix;
    // Clean name
    newName = newName.replace(/[^a-zA-Z0-9_-]/g, "-");

    await db.update(icons).set({ name: newName }).where(eq(icons.id, icon.id));
  }

  return { success: true };
});

export default component$(() => {
  const data = useProject();
  const loc = useLocation();
  const nav = useNavigate();
  const deleteIcon = useDeleteIcon();
  const updateProject = useUpdateProject();
  const updateIcon = useUpdateIcon();
  const batchRenameIcons = useBatchRenameIcons();

  const project = useStore({ ...data.value.project });
  const icons = useStore({ list: [...data.value.icons] });
  const selectedIds = useStore({ ids: new Set<number>() });
  const uploadLoading = useSignal(false);
  const dragOver = useSignal(false);
  const showSettings = useSignal(false);
  const showCode = useSignal(false);
  const showEdit = useSignal(false);
  const showSVGSource = useSignal(false);
  const showPreview = useSignal(false);
  const showBatchRename = useSignal(false);
  const confirmDeleteIcon = useStore<{
    show: boolean;
    iconId: number;
    iconName: string;
  }>({ show: false, iconId: 0, iconName: "" });
  const confirmBatchDelete = useStore<{ show: boolean; count: number }>({
    show: false,
    count: 0,
  });
  const renameForm = useStore({
    prefix: "",
    suffix: "",
    find: "",
    replace: "",
  });
  const editingIcon = useStore<Partial<Icon>>({});
  const previewIcon = useStore<Partial<Icon>>({});
  const codeMode = useSignal<"symbol" | "fontclass" | "unicode">("fontclass");
  const generatedCode = useSignal("");
  const searchQuery = useSignal(loc.url.searchParams.get("search") || "");
  const sortBy = useSignal<"name" | "time" | "unicode">(
    (loc.url.searchParams.get("sort") as any) || "time",
  );
  const copied = useSignal(false);
  const previewColor = useSignal("#333333");
  const downloadLoading = useSignal<"font" | "package" | null>(null);
  const showShortcuts = useSignal(false);
  const fontPreviewBase64 = useSignal("");

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

  // Sync search/sort to URL query params
  useTask$(({ track }) => {
    track(() => searchQuery.value);
    track(() => sortBy.value);
    const url = new URL(loc.url.href);
    if (searchQuery.value) url.searchParams.set("search", searchQuery.value);
    else url.searchParams.delete("search");
    if (sortBy.value !== "time") url.searchParams.set("sort", sortBy.value);
    else url.searchParams.delete("sort");
    if (url.search !== loc.url.search) {
      window.history.replaceState({}, "", url.toString());
    }
  });

  // Dynamic page title
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => project.name);
    document.title = `${project.name} - Iconfont`;
  });

  // Keyboard shortcuts
  useOnDocument(
    "keydown",
    $((ev: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = ev.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      )
        return;

      // Esc: close any open modal
      if (ev.key === "Escape") {
        if (showShortcuts.value) {
          showShortcuts.value = false;
          return;
        }
        if (showPreview.value) {
          showPreview.value = false;
          return;
        }
        if (showEdit.value) {
          showEdit.value = false;
          return;
        }
        if (showCode.value) {
          showCode.value = false;
          return;
        }
        if (showSettings.value) {
          showSettings.value = false;
          return;
        }
        if (showBatchRename.value) {
          showBatchRename.value = false;
          return;
        }
        if (confirmDeleteIcon.show) {
          confirmDeleteIcon.show = false;
          return;
        }
        if (confirmBatchDelete.show) {
          confirmBatchDelete.show = false;
          return;
        }
      }

      // ?: show keyboard shortcuts help
      if (ev.key === "?" && !ev.shiftKey) {
        showShortcuts.value = true;
        return;
      }

      // Ctrl+A / Cmd+A: select all visible icons
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "a") {
        // eslint-disable-next-line qwik/no-async-prevent-default
        ev.preventDefault();
        selectAll();
        return;
      }

      // Delete: delete selected icons
      if (ev.key === "Delete" && selectedIds.ids.size > 0) {
        const visible = filteredIcons.value.map((i) => i.id);
        const selectedVisible = visible.filter((id) => selectedIds.ids.has(id));
        if (selectedVisible.length > 0) {
          confirmBatchDelete.count = selectedIds.ids.size;
          confirmBatchDelete.show = true;
        }
        return;
      }

      // / : focus search
      if (ev.key === "/") {
        // eslint-disable-next-line qwik/no-async-prevent-default
        ev.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder="搜索图标..."]',
        ) as HTMLInputElement;
        searchInput?.focus();
      }
    }),
  );

  const renamePreview = useComputed$(() => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    return {
      items: selected.slice(0, 5).map((icon) => {
        let newName = icon.name;
        if (renameForm.find)
          newName = newName.split(renameForm.find).join(renameForm.replace);
        newName = renameForm.prefix + newName + renameForm.suffix;
        newName = newName.replace(/[^a-zA-Z0-9_-]/g, "-");
        return { oldName: icon.name, newName };
      }),
      total: selected.length,
    };
  });

  const filteredIcons = useComputed$(() => {
    let list = [...icons.list];
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (sortBy.value === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy.value === "unicode") {
      list.sort((a, b) => (a.unicode || "").localeCompare(b.unicode || ""));
    }
    return list;
  });

  const handleFileUpload = $(async (files: FileList | null) => {
    if (!files) return;
    uploadLoading.value = true;
    dragOver.value = false;
    const projectId = loc.params.id;

    const svgFiles = Array.from(files).filter(
      (file) => file.name.endsWith(".svg") || file.type === "image/svg+xml",
    );
    const skipped = files.length - svgFiles.length;

    const uploadOne = async (file: File) => {
      const content = await file.text();
      const formData = new FormData();
      formData.append("name", file.name.replace(/\.svg$/i, ""));
      formData.append("content", content);
      const res = await fetch(`/api/projects/${projectId}/icons`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const result = await res.json() as { icon: Icon };
        return result.icon;
      }
      return null;
    };

    const results: (Icon | null)[] = [];
    const concurrency = 5;
    for (let i = 0; i < svgFiles.length; i += concurrency) {
      const batch = svgFiles.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(uploadOne));
      results.push(...batchResults);
    }

    const uploaded = results.filter(Boolean) as Icon[];
    uploaded.forEach((icon) => icons.list.push(icon));

    uploadLoading.value = false;
    if (skipped > 0) {
      showToast(
        `已上传 ${uploaded.length} 个图标，跳过 ${skipped} 个非 SVG 文件`,
        uploaded.length > 0 ? "info" : "error",
      );
    } else if (uploaded.length > 0) {
      showToast(`成功上传 ${uploaded.length} 个图标`, "success");
    } else {
      showToast("没有可上传的 SVG 文件", "error");
    }
  });

  const handleDelete = $((iconId: number, iconName: string) => {
    confirmDeleteIcon.show = true;
    confirmDeleteIcon.iconId = iconId;
    confirmDeleteIcon.iconName = iconName;
  });

  const doDeleteIcon = $(async () => {
    const iconId = confirmDeleteIcon.iconId;
    confirmDeleteIcon.show = false;
    await deleteIcon.submit({ id: String(iconId) });
    icons.list = icons.list.filter((i) => i.id !== iconId);
    const next = new Set(selectedIds.ids);
    next.delete(iconId);
    selectedIds.ids = next;
    showToast(`图标 "${confirmDeleteIcon.iconName}" 已删除`, "success");
  });

  const doBatchDelete = $(async () => {
    const count = confirmBatchDelete.count;
    confirmBatchDelete.show = false;
    await Promise.all(
      Array.from(selectedIds.ids).map((id) =>
        deleteIcon.submit({ id: String(id) }),
      ),
    );
    icons.list = icons.list.filter((i) => !selectedIds.ids.has(i.id));
    selectedIds.ids = new Set();
    showToast(`已删除 ${count} 个图标`, "success");
  });

  const toggleSelect = $((id: number) => {
    const next = new Set(selectedIds.ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.ids = next;
  });

  const selectAll = $(() => {
    const visible = filteredIcons.value.map((i) => i.id);
    const allSelected = visible.every((id) => selectedIds.ids.has(id));
    if (allSelected) {
      visible.forEach((id) => selectedIds.ids.delete(id));
      selectedIds.ids = new Set(selectedIds.ids);
    } else {
      visible.forEach((id) => selectedIds.ids.add(id));
      selectedIds.ids = new Set(selectedIds.ids);
    }
  });

  const autoUnicode = $(() => {
    let maxCode = 0xe5ff;
    for (const icon of icons.list) {
      if (icon.unicode) {
        const hex = icon.unicode
          .replace(/^&#x?|^\\|^U\+/i, "")
          .replace(/;$/, "");
        const code = parseInt(hex, 16);
        if (!isNaN(code) && code > maxCode) maxCode = code;
      }
    }
    editingIcon.unicode = `&#x${(maxCode + 1).toString(16)};`;
  });

  const buildCode = $(() => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    if (selected.length === 0) return "请先选择图标";

    if (codeMode.value === "fontclass") {
      return generateCSS(project.font_family, project.prefix, selected);
    }

    if (codeMode.value === "symbol") {
      return generateSymbolSVG(selected, project.prefix);
    }

    return selected
      .map((icon) => {
        const unicode =
          icon.unicode || `&#x${(0xe000 + icon.id).toString(16)};`;
        return `<i class="${project.prefix}" style="font-family: '${project.font_family}'">${unicode}</i>`;
      })
      .join("\n");
  });

  const handleDownloadFont = $(async () => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    if (selected.length === 0) return;
    downloadLoading.value = "font";
    try {
      const ttf = await generateTTFFont(
        project.font_family,
        selected,
        project.prefix,
      );
      if (!ttf) {
        showToast("字体生成失败", "error");
        return;
      }
      const blob = new Blob([ttf], { type: "font/ttf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.font_family}.ttf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("字体下载成功", "success");
    } finally {
      downloadLoading.value = null;
    }
  });

  const handleDownloadPackage = $(async () => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    if (selected.length === 0) return;
    downloadLoading.value = "package";
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file(
        `${project.font_family}.css`,
        generateCSS(project.font_family, project.prefix, selected),
      );
      zip.file(
        `${project.font_family}-symbol.svg`,
        generateSymbolSVG(selected, project.prefix),
      );
      zip.file(
        "demo.html",
        await generateDemoHTML(project.font_family, project.prefix, selected),
      );
      const ttf = await generateTTFFont(
        project.font_family,
        selected,
        project.prefix,
      );
      if (ttf) zip.file(`${project.font_family}.ttf`, new Uint8Array(ttf));
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.font_family}-iconfont.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("打包下载成功", "success");
    } finally {
      downloadLoading.value = null;
    }
  });

  useTask$(async ({ track }) => {
    track(() => codeMode.value);
    track(() => selectedIds.ids.size);
    track(() => icons.list.length);
    generatedCode.value = await buildCode();
  });

  useTask$(async ({ track }) => {
    track(() => showCode.value);
    track(() => codeMode.value);
    track(() => selectedIds.ids.size);
    if (
      !showCode.value ||
      codeMode.value !== "fontclass" ||
      selectedIds.ids.size === 0
    ) {
      fontPreviewBase64.value = "";
      return;
    }
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    const ttf = await generateTTFFont(
      project.font_family,
      selected,
      project.prefix,
    );
    if (ttf) {
      const bytes = new Uint8Array(ttf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontPreviewBase64.value = btoa(binary);
    }
  });

  const fontPreviewCSS = useComputed$(() => {
    if (!fontPreviewBase64.value) return "";
    const selected = icons.list
      .filter((i) => selectedIds.ids.has(i.id))
      .slice(0, 8);
    const classes = selected
      .map((icon, i) => {
        const unicode = icon.unicode || `\\${(0xe000 + i).toString(16)}`;
        return `.${project.prefix}${icon.name}:before { content: "${unicode}"; }`;
      })
      .join("\n");
    return `@font-face { font-family: "${project.font_family}"; src: url("data:font/truetype;charset=utf-8;base64,${fontPreviewBase64.value}") format("truetype"); font-weight: normal; font-style: normal; }
.${project.prefix} { font-family: "${project.font_family}" !important; font-style: normal; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
${classes}`;
  });

  const copyToClipboard = $(async () => {
    await navigator.clipboard.writeText(generatedCode.value);
    copied.value = true;
    showToast("代码已复制到剪贴板", "success");
    setTimeout(() => (copied.value = false), 2000);
  });

  const displayList = filteredIcons.value;

  return (
    <div class="bg-base-200 min-h-screen">
      <ToastContainer toasts={toasts.items} />

      {/* Header */}
      <div class="navbar bg-base-100 px-4 shadow-sm">
        <div class="flex-none">
          <div class="breadcrumbs text-sm">
            <ul>
              <li>
                <button
                  class="btn btn-ghost btn-xs gap-1"
                  onClick$={() => nav("/")}
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
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  首页
                </button>
              </li>
              <li class="max-w-[200px] truncate font-bold">{project.name}</li>
            </ul>
          </div>
        </div>
        <div class="hidden min-w-0 flex-1 px-4 md:block">
          <p class="text-xs text-gray-500">
            {icons.list.length} 个图标 · Font: {project.font_family}
          </p>
        </div>
        {/* Desktop actions */}
        <div class="hidden flex-none flex-wrap justify-end gap-2 md:flex">
          <button
            class="btn btn-outline btn-sm"
            onClick$={() => (showSettings.value = true)}
          >
            项目设置
          </button>
          <div
            class="tooltip tooltip-bottom"
            data-tip={selectedIds.ids.size === 0 ? "请先选择图标" : undefined}
          >
            <button
              class="btn btn-outline btn-sm"
              onClick$={handleDownloadFont}
              disabled={
                selectedIds.ids.size === 0 || downloadLoading.value === "font"
              }
            >
              {downloadLoading.value === "font" ? (
                <span class="loading loading-spinner loading-xs" />
              ) : (
                "下载字体"
              )}
            </button>
          </div>
          <div
            class="tooltip tooltip-bottom"
            data-tip={selectedIds.ids.size === 0 ? "请先选择图标" : undefined}
          >
            <button
              class="btn btn-primary btn-sm"
              onClick$={async () => {
                showCode.value = true;
                generatedCode.value = await buildCode();
              }}
              disabled={selectedIds.ids.size === 0}
            >
              生成代码
            </button>
          </div>
          <div
            class="tooltip tooltip-bottom"
            data-tip={selectedIds.ids.size === 0 ? "请先选择图标" : undefined}
          >
            <button
              class="btn btn-secondary btn-sm"
              onClick$={handleDownloadPackage}
              disabled={
                selectedIds.ids.size === 0 ||
                downloadLoading.value === "package"
              }
            >
              {downloadLoading.value === "package" ? (
                <span class="loading loading-spinner loading-xs" />
              ) : (
                "打包下载"
              )}
            </button>
          </div>
        </div>
        {/* Mobile actions dropdown */}
        <div class="dropdown dropdown-end md:hidden">
          <button tabIndex={0} class="btn btn-ghost btn-sm btn-square">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
          <ul
            tabIndex={0}
            class="dropdown-content menu bg-base-100 rounded-box z-[1] w-40 p-2 shadow"
          >
            <li>
              <button onClick$={() => (showSettings.value = true)}>
                项目设置
              </button>
            </li>
            <li>
              <button
                onClick$={handleDownloadFont}
                disabled={
                  selectedIds.ids.size === 0 || downloadLoading.value === "font"
                }
              >
                {downloadLoading.value === "font" ? (
                  <span class="loading loading-spinner loading-xs mr-1" />
                ) : null}
                下载字体
              </button>
            </li>
            <li>
              <button
                onClick$={async () => {
                  showCode.value = true;
                  generatedCode.value = await buildCode();
                }}
                disabled={selectedIds.ids.size === 0}
              >
                生成代码
              </button>
            </li>
            <li>
              <button
                onClick$={handleDownloadPackage}
                disabled={
                  selectedIds.ids.size === 0 ||
                  downloadLoading.value === "package"
                }
              >
                {downloadLoading.value === "package" ? (
                  <span class="loading loading-spinner loading-xs mr-1" />
                ) : null}
                打包下载
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Toolbar */}
      <div class="container mx-auto px-4 py-4">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <label class="label cursor-pointer gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                checked={
                  displayList.length > 0 &&
                  displayList.every((i) => selectedIds.ids.has(i.id))
                }
                onChange$={selectAll}
              />
              <span class="label-text text-sm">
                全选 ({selectedIds.ids.size}/{icons.list.length})
              </span>
            </label>
            {selectedIds.ids.size > 0 && (
              <>
                <button
                  class="btn btn-error btn-sm"
                  onClick$={() => {
                    confirmBatchDelete.count = selectedIds.ids.size;
                    confirmBatchDelete.show = true;
                  }}
                >
                  删除选中
                </button>
                <button
                  class="btn btn-outline btn-sm"
                  onClick$={() => (showBatchRename.value = true)}
                >
                  批量重命名
                </button>
              </>
            )}
          </div>
          <div class="flex gap-2">
            <div class="relative">
              <input
                type="file"
                accept=".svg"
                multiple
                class="absolute inset-0 z-10 cursor-pointer opacity-0"
                onChange$={(ev: any) => handleFileUpload(ev.target.files)}
              />
              <button class="btn btn-primary btn-sm gap-1">
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                {uploadLoading.value ? "上传中..." : "上传图标"}
              </button>
            </div>
          </div>
        </div>

        {/* Search & Sort */}
        <div class="mb-3 flex flex-wrap gap-2">
          <div class="min-w-[200px] flex-1">
            <div class="relative">
              <input
                type="text"
                class="input input-bordered input-sm w-full pr-8 pl-9"
                placeholder="搜索图标..."
                value={searchQuery.value}
                onInput$={(ev: any) => (searchQuery.value = ev.target.value)}
              />
              <svg
                class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
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
                  class="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
          <select
            class="select select-bordered select-sm"
            value={sortBy.value}
            onChange$={(ev: any) => (sortBy.value = ev.target.value)}
          >
            <option value="time">按时间排序</option>
            <option value="name">按名称排序</option>
            <option value="unicode">按Unicode排序</option>
          </select>
          <span class="self-center text-xs text-gray-500">
            {displayList.length} / {icons.list.length}
          </span>
        </div>

        {/* Drop zone */}
        <div
          class={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${dragOver.value ? "border-primary bg-primary/5 text-primary scale-[1.01] shadow-lg" : "border-base-300 hover:border-primary/50 hover:bg-base-100 text-gray-500"}`}
          onDragOver$={(ev: any) => {
            ev.preventDefault();
            dragOver.value = true;
          }}
          onDragLeave$={() => (dragOver.value = false)}
          onDrop$={(ev: any) => {
            ev.preventDefault();
            handleFileUpload(ev.dataTransfer.files);
          }}
        >
          <div
            class={`transition-transform duration-200 ${dragOver.value ? "scale-110" : ""}`}
          >
            <svg
              class="mx-auto mb-3 text-current"
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <p class="font-medium">
              {dragOver.value
                ? "松开鼠标上传 SVG 文件"
                : "拖拽 SVG 文件到此处上传"}
            </p>
            <p class="mt-1 text-xs opacity-70">或点击上方「上传图标」按钮</p>
          </div>
        </div>
      </div>

      {/* Icons Grid */}
      <div class="container mx-auto px-4 pb-8">
        {displayList.length === 0 ? (
          <div class="card bg-base-100 shadow">
            <div class="card-body items-center py-12 text-center">
              <svg
                class="mb-3 animate-empty-float text-gray-300"
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
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
              <p class="text-gray-500">
                {searchQuery.value
                  ? "未找到匹配的图标"
                  : "暂无图标，请上传 SVG 文件"}
              </p>
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {/* Skeleton cards shown while uploading */}
            {uploadLoading.value && (
              <>
                <SkeletonIconCard />
                <SkeletonIconCard />
                <SkeletonIconCard />
              </>
            )}
            {displayList.map((icon, idx) => (
              <div
                key={icon.id}
                class={`card bg-base-100 group shadow card-hover-lift hover:shadow-lg animate-icon-pop icon-selected ${selectedIds.ids.has(icon.id) ? "ring-primary bg-primary/5 ring-2" : ""}`}
                style={`animation-delay: ${(idx % 12) * 0.02}s`}
              >
                <div class="card-body relative items-center p-3 text-center">
                  {/* Selection checkbox */}
                  <button
                    class={`absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded border checkbox-smooth ${selectedIds.ids.has(icon.id) ? "bg-primary border-primary" : "border-base-300 bg-base-100 hover:border-primary"}`}
                    onClick$={() => toggleSelect(icon.id)}
                    title={selectedIds.ids.has(icon.id) ? "取消选择" : "选择"}
                  >
                    {selectedIds.ids.has(icon.id) && (
                      <svg
                        class="h-3.5 w-3.5 animate-check-pop text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  {/* Preview click area */}
                  <button
                    class="mt-1 flex h-14 w-14 items-center justify-center transition-transform hover:scale-110"
                    onClick$={() => {
                      previewIcon.id = icon.id;
                      previewIcon.name = icon.name;
                      previewIcon.content = icon.content;
                      previewIcon.unicode = icon.unicode;
                      showPreview.value = true;
                    }}
                    title="点击预览"
                  >
                    {icon.content ? (
                      <SvgPreview
                        content={icon.content}
                        class="h-full w-full"
                      />
                    ) : (
                      <span class="text-xs text-gray-400">无预览</span>
                    )}
                  </button>
                  <p
                    class="w-full truncate text-xs font-medium"
                    title={icon.name}
                  >
                    <HighlightText text={icon.name} query={searchQuery.value} />
                  </p>
                  {icon.unicode && (
                    <button
                      class="hover:text-primary font-mono text-[10px] text-gray-400 transition-colors"
                      title="点击复制 Unicode"
                      onClick$={async () => {
                        await navigator.clipboard.writeText(icon.unicode || "");
                        showToast(`已复制 ${icon.unicode}`, "success");
                      }}
                    >
                      {icon.unicode}
                    </button>
                  )}
                  {/* Action buttons */}
                  <div class="mt-1 flex gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <button
                      class="btn btn-ghost btn-xs btn-square"
                      title="编辑"
                      onClick$={() => {
                        editingIcon.id = icon.id;
                        editingIcon.name = icon.name;
                        editingIcon.unicode = icon.unicode;
                        editingIcon.view_box = icon.view_box;
                        editingIcon.content = icon.content;
                        showEdit.value = true;
                      }}
                    >
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
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      class="btn btn-ghost btn-xs btn-square"
                      title="下载 SVG"
                      onClick$={() => {
                        const blob = new Blob([icon.content || ""], {
                          type: "image/svg+xml",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${icon.name}.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast(`已下载 ${icon.name}.svg`, "success");
                      }}
                    >
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
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                    </button>
                    <button
                      class="btn btn-ghost btn-xs btn-square text-error"
                      title="删除"
                      onClick$={() => handleDelete(icon.id, icon.name)}
                    >
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
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-lg animate-modal-box">
            <h3 class="mb-4 text-lg font-bold">项目设置</h3>
            <form
              preventdefault:submit
              onSubmit$={async (ev: any) => {
                const fd = new FormData(ev.target);
                await updateProject.submit({
                  id: loc.params.id,
                  name: fd.get("name"),
                  description: fd.get("description"),
                  font_family: fd.get("font_family"),
                  prefix: fd.get("prefix"),
                });
                project.name = fd.get("name") as string;
                project.description = fd.get("description") as string;
                project.font_family = fd.get("font_family") as string;
                project.prefix = fd.get("prefix") as string;
                showSettings.value = false;
                showToast("项目设置已保存", "success");
              }}
            >
              <div class="form-control mb-3">
                <label class="label">
                  <span class="label-text">项目名称</span>
                </label>
                <input
                  name="name"
                  type="text"
                  class="input input-bordered"
                  value={project.name}
                  required
                />
              </div>
              <div class="form-control mb-3">
                <label class="label">
                  <span class="label-text">描述</span>
                </label>
                <input
                  name="description"
                  type="text"
                  class="input input-bordered"
                  value={project.description || ""}
                />
              </div>
              <div class="form-control mb-3">
                <label class="label">
                  <span class="label-text">Font Family</span>
                </label>
                <input
                  name="font_family"
                  type="text"
                  class="input input-bordered"
                  value={project.font_family}
                />
              </div>
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">Class 前缀</span>
                </label>
                <input
                  name="prefix"
                  type="text"
                  class="input input-bordered"
                  value={project.prefix}
                />
                <label class="label">
                  <span class="label-text-alt font-mono text-gray-400">
                    示例: <span class="text-primary">{project.prefix}</span>
                    example
                  </span>
                </label>
              </div>
              <div class="modal-action">
                <button
                  type="button"
                  class="btn"
                  onClick$={() => (showSettings.value = false)}
                >
                  取消
                </button>
                <button type="submit" class="btn btn-primary">
                  保存
                </button>
              </div>
            </form>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => (showSettings.value = false)}
          />
        </div>
      )}

      {/* Preview Icon Modal */}
      {showPreview.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-sm text-center animate-modal-box">
            <h3 class="mb-4 text-lg font-bold">{previewIcon.name}</h3>
            <div class="bg-base-200 mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-lg p-4">
              {previewIcon.content && (
                <SvgPreview
                  content={previewIcon.content}
                  class="h-full w-full"
                  color={previewColor.value}
                />
              )}
            </div>
            {/* Color picker */}
            <div class="mb-4 flex items-center justify-center gap-2">
              {[
                "#333333",
                "#ef4444",
                "#22c55e",
                "#3b82f6",
                "#f59e0b",
                "#a855f7",
                "#ec4899",
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  class={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${previewColor.value === c ? "border-primary scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick$={() => (previewColor.value = c)}
                  title={c}
                />
              ))}
              <input
                type="color"
                class="h-6 w-6 cursor-pointer overflow-hidden rounded-full border-0 p-0"
                value={previewColor.value}
                onInput$={(ev: any) => (previewColor.value = ev.target.value)}
              />
            </div>
            {previewIcon.unicode && (
              <p class="mb-4 font-mono text-sm text-gray-500">
                {previewIcon.unicode}
              </p>
            )}
            <div class="modal-action justify-center">
              <button class="btn" onClick$={() => (showPreview.value = false)}>
                关闭
              </button>
            </div>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => (showPreview.value = false)}
          />
        </div>
      )}

      {/* Edit Icon Modal */}
      {showEdit.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-lg animate-modal-box">
            <h3 class="mb-4 text-lg font-bold">编辑图标</h3>
            <div class="flex gap-4">
              <div class="flex flex-shrink-0 flex-col items-center gap-2">
                <div class="bg-base-200 flex h-24 w-24 items-center justify-center rounded-lg p-3">
                  {editingIcon.content && (
                    <SvgPreview
                      content={editingIcon.content}
                      class="h-full w-full"
                      color={previewColor.value}
                    />
                  )}
                </div>
                <div class="flex items-center gap-1">
                  {[
                    "#333333",
                    "#ef4444",
                    "#22c55e",
                    "#3b82f6",
                    "#f59e0b",
                    "#a855f7",
                    "#ec4899",
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      class={`h-4 w-4 rounded-full border-2 transition-transform hover:scale-110 ${previewColor.value === c ? "border-primary scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      onClick$={() => (previewColor.value = c)}
                    />
                  ))}
                  <input
                    type="color"
                    class="h-4 w-4 cursor-pointer overflow-hidden rounded-full border-0 p-0"
                    value={previewColor.value}
                    onInput$={(ev: any) =>
                      (previewColor.value = ev.target.value)
                    }
                  />
                </div>
              </div>
              <form
                class="flex-1"
                preventdefault:submit
                onSubmit$={async (ev: any) => {
                  const fd = new FormData(ev.target);
                  const iconId = editingIcon.id;
                  const newContent = fd.get("content") as string;
                  await updateIcon.submit({
                    id: String(iconId),
                    name: fd.get("name"),
                    unicode: fd.get("unicode") || null,
                    view_box: fd.get("view_box") || "0 0 1024 1024",
                    content: newContent || null,
                  });
                  const idx = icons.list.findIndex((i) => i.id === iconId);
                  if (idx >= 0)
                    icons.list[idx] = {
                      ...icons.list[idx],
                      name: fd.get("name") as string,
                      unicode: (fd.get("unicode") as string) || null,
                      view_box: fd.get("view_box") as string,
                      content: newContent,
                    };
                  showEdit.value = false;
                  showSVGSource.value = false;
                }}
              >
                <div class="form-control mb-3">
                  <label class="label">
                    <span class="label-text">图标名称</span>
                  </label>
                  <input
                    name="name"
                    type="text"
                    class="input input-bordered"
                    value={editingIcon.name}
                    required
                  />
                </div>
                <div class="form-control mb-3">
                  <label class="label">
                    <span class="label-text">Unicode</span>
                  </label>
                  <div class="flex gap-2">
                    <input
                      name="unicode"
                      type="text"
                      class="input input-bordered flex-1"
                      value={editingIcon.unicode || ""}
                      placeholder="例如: &#xe600;"
                    />
                    <button
                      type="button"
                      class="btn btn-outline btn-sm"
                      onClick$={autoUnicode}
                    >
                      自动生成
                    </button>
                  </div>
                </div>
                <div class="form-control mb-3">
                  <label class="label">
                    <span class="label-text">ViewBox</span>
                  </label>
                  <input
                    name="view_box"
                    type="text"
                    class="input input-bordered"
                    value={editingIcon.view_box || "0 0 1024 1024"}
                  />
                  <label class="label">
                    <span class="label-text-alt text-gray-400">
                      控制 SVG 的坐标系，影响字体生成时的缩放比例
                    </span>
                  </label>
                </div>
                <div class="form-control mb-4">
                  <label
                    class="label cursor-pointer"
                    onClick$={() =>
                      (showSVGSource.value = !showSVGSource.value)
                    }
                  >
                    <span class="label-text">SVG 源码</span>
                    <span class="label-text-alt text-primary">
                      {showSVGSource.value ? "收起 ↑" : "展开 ↓"}
                    </span>
                  </label>
                  {showSVGSource.value && (
                    <textarea
                      name="content"
                      class="textarea textarea-bordered h-32 w-full font-mono text-xs"
                      value={editingIcon.content || ""}
                      placeholder="<svg viewBox='0 0 1024 1024'>..."
                    />
                  )}
                </div>
                <div class="modal-action">
                  <button
                    type="button"
                    class="btn"
                    onClick$={() => {
                      showEdit.value = false;
                      showSVGSource.value = false;
                    }}
                  >
                    取消
                  </button>
                  <button type="submit" class="btn btn-primary">
                    保存
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => (showEdit.value = false)}
          />
        </div>
      )}

      {/* Code Generation Modal */}
      {showCode.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-3xl animate-modal-box">
            <h3 class="mb-4 text-lg font-bold">生成代码</h3>
            <div class="tabs tabs-boxed mb-4">
              <button
                class={`tab ${codeMode.value === "fontclass" ? "tab-active" : ""}`}
                onClick$={() => (codeMode.value = "fontclass")}
              >
                Font Class
              </button>
              <button
                class={`tab ${codeMode.value === "symbol" ? "tab-active" : ""}`}
                onClick$={() => (codeMode.value = "symbol")}
              >
                Symbol
              </button>
              <button
                class={`tab ${codeMode.value === "unicode" ? "tab-active" : ""}`}
                onClick$={() => (codeMode.value = "unicode")}
              >
                Unicode
              </button>
            </div>

            {/* Font preview for fontclass mode */}
            {codeMode.value === "fontclass" && selectedIds.ids.size > 0 && (
              <div class="bg-base-200 mb-4 rounded-lg p-4">
                <p class="mb-2 text-xs text-gray-500">字体预览</p>
                {fontPreviewCSS.value && <style>{fontPreviewCSS.value}</style>}
                <div class="flex flex-wrap gap-3">
                  {icons.list
                    .filter((i) => selectedIds.ids.has(i.id))
                    .slice(0, 8)
                    .map((icon) => (
                      <div
                        key={icon.id}
                        class="flex flex-col items-center gap-1"
                      >
                        <i
                          class={`${project.prefix} ${project.prefix}${icon.name}`}
                          style="font-size: 24px;"
                        ></i>
                        <span class="text-[10px] text-gray-400">
                          {icon.name}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Symbol usage preview */}
            {codeMode.value === "symbol" && selectedIds.ids.size > 0 && (
              <div class="bg-base-200 mb-4 rounded-lg p-4">
                <p class="mb-2 text-xs text-gray-500">Symbol 引用示例</p>
                <div class="flex flex-wrap gap-3">
                  {icons.list
                    .filter((i) => selectedIds.ids.has(i.id))
                    .slice(0, 8)
                    .map((icon) => (
                      <div
                        key={icon.id}
                        class="flex flex-col items-center gap-1"
                      >
                        <svg class="h-6 w-6" aria-hidden="true">
                          <use href={`#${project.prefix}${icon.name}`} />
                        </svg>
                        <span class="text-[10px] text-gray-400">
                          {icon.name}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Unicode preview */}
            {codeMode.value === "unicode" && selectedIds.ids.size > 0 && (
              <div class="bg-base-200 mb-4 rounded-lg p-4">
                <p class="mb-2 text-xs text-gray-500">Unicode 预览</p>
                <div class="flex flex-wrap gap-3">
                  {icons.list
                    .filter((i) => selectedIds.ids.has(i.id))
                    .slice(0, 8)
                    .map((icon, idx) => {
                      const code = icon.unicode
                        ? parseInt(
                            icon.unicode
                              .replace(/^&#x?|^\\|^U\+/i, "")
                              .replace(/;$/, ""),
                            16,
                          )
                        : 0xe000 + idx;
                      return (
                        <div
                          key={icon.id}
                          class="flex flex-col items-center gap-1"
                        >
                          <span class="text-2xl">
                            {String.fromCharCode(code)}
                          </span>
                          <span class="text-[10px] text-gray-400">
                            {icon.name}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div class="bg-base-300 group relative rounded-lg p-4">
              <pre class="max-h-80 overflow-auto text-sm whitespace-pre-wrap">
                <code>{generatedCode.value}</code>
              </pre>
              <button
                class={`btn btn-xs absolute top-2 right-2 ${copied.value ? "btn-success" : "btn-ghost transition-opacity md:opacity-0 md:group-hover:opacity-100"}`}
                onClick$={copyToClipboard}
              >
                {copied.value ? "已复制!" : "复制"}
              </button>
            </div>
            <div class="modal-action">
              <button
                class="btn btn-primary"
                onClick$={() => {
                  const code = generatedCode.value;
                  if (!code) return;
                  const mode = codeMode.value;
                  const mime =
                    mode === "symbol"
                      ? "image/svg+xml"
                      : mode === "fontclass"
                        ? "text/css"
                        : "text/plain";
                  const ext =
                    mode === "symbol"
                      ? "svg"
                      : mode === "fontclass"
                        ? "css"
                        : "txt";
                  const blob = new Blob([code], { type: mime });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${project.font_family}.${ext}`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast(`已下载 ${project.font_family}.${ext}`, "success");
                }}
              >
                下载代码
              </button>
              <button class="btn" onClick$={() => (showCode.value = false)}>
                关闭
              </button>
            </div>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => (showCode.value = false)}
          />
        </div>
      )}

      {/* Batch Rename Modal */}
      {showBatchRename.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-lg animate-modal-box">
            <h3 class="mb-4 text-lg font-bold">
              批量重命名 ({selectedIds.ids.size} 个图标)
            </h3>
            <form
              preventdefault:submit
              onSubmit$={async () => {
                const ids = Array.from(selectedIds.ids).join(",");
                await batchRenameIcons.submit({
                  ids,
                  prefix: renameForm.prefix,
                  suffix: renameForm.suffix,
                  find: renameForm.find,
                  replace: renameForm.replace,
                });
                for (let i = 0; i < icons.list.length; i++) {
                  const icon = icons.list[i];
                  if (!selectedIds.ids.has(icon.id)) continue;
                  let newName = icon.name;
                  if (renameForm.find)
                    newName = newName
                      .split(renameForm.find)
                      .join(renameForm.replace);
                  newName = renameForm.prefix + newName + renameForm.suffix;
                  newName = newName.replace(/[^a-zA-Z0-9_-]/g, "-");
                  icons.list[i] = { ...icon, name: newName };
                }
                renameForm.prefix = "";
                renameForm.suffix = "";
                renameForm.find = "";
                renameForm.replace = "";
                selectedIds.ids = new Set();
                showBatchRename.value = false;
                showToast("批量重命名完成", "success");
              }}
            >
              <div class="mb-3 grid grid-cols-2 gap-3">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">前缀</span>
                  </label>
                  <input
                    type="text"
                    class="input input-bordered input-sm"
                    placeholder="例如: icon-"
                    value={renameForm.prefix}
                    onInput$={(ev: any) =>
                      (renameForm.prefix = ev.target.value)
                    }
                  />
                </div>
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">后缀</span>
                  </label>
                  <input
                    type="text"
                    class="input input-bordered input-sm"
                    placeholder="例如: -new"
                    value={renameForm.suffix}
                    onInput$={(ev: any) =>
                      (renameForm.suffix = ev.target.value)
                    }
                  />
                </div>
              </div>
              <div class="mb-3 grid grid-cols-2 gap-3">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">查找</span>
                  </label>
                  <input
                    type="text"
                    class="input input-bordered input-sm"
                    placeholder="要替换的文本"
                    value={renameForm.find}
                    onInput$={(ev: any) => (renameForm.find = ev.target.value)}
                  />
                </div>
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">替换为</span>
                  </label>
                  <input
                    type="text"
                    class="input input-bordered input-sm"
                    placeholder="新文本"
                    value={renameForm.replace}
                    onInput$={(ev: any) =>
                      (renameForm.replace = ev.target.value)
                    }
                  />
                </div>
              </div>

              {/* Live preview */}
              {renamePreview.value.items.length > 0 && (
                <div class="bg-base-200 mb-4 rounded-lg p-3">
                  <p class="mb-2 text-xs text-gray-500">
                    预览
                    {renamePreview.value.total >
                      renamePreview.value.items.length && (
                      <span class="text-gray-400">
                        （前 {renamePreview.value.items.length} 个，共{" "}
                        {renamePreview.value.total} 个）
                      </span>
                    )}
                  </p>
                  <div class="space-y-1 text-sm">
                    {renamePreview.value.items.map((p, idx) => (
                      <div key={idx} class="flex items-center gap-2">
                        <span class="flex-1 truncate text-gray-400 line-through">
                          {p.oldName}
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          class="flex-shrink-0 text-gray-400"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                        <span class="text-primary flex-1 truncate font-medium">
                          {p.newName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div class="modal-action">
                <button
                  type="button"
                  class="btn"
                  onClick$={() => {
                    renameForm.prefix = "";
                    renameForm.suffix = "";
                    renameForm.find = "";
                    renameForm.replace = "";
                    showBatchRename.value = false;
                  }}
                >
                  取消
                </button>
                <button type="submit" class="btn btn-primary">
                  应用
                </button>
              </div>
            </form>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => (showBatchRename.value = false)}
          />
        </div>
      )}

      {/* Confirm Delete Icon Modal */}
      {confirmDeleteIcon.show && (
        <div class="modal modal-open">
          <div class="modal-box max-w-sm animate-modal-box">
            <h3 class="mb-2 text-lg font-bold">确认删除</h3>
            <p class="mb-4 text-gray-500">
              确定要删除图标 "{confirmDeleteIcon.iconName}" 吗？此操作不可恢复。
            </p>
            <div class="modal-action">
              <button
                class="btn"
                onClick$={() => {
                  confirmDeleteIcon.show = false;
                  confirmDeleteIcon.iconId = 0;
                }}
              >
                取消
              </button>
              <button class="btn btn-error" onClick$={doDeleteIcon}>
                删除
              </button>
            </div>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => {
              confirmDeleteIcon.show = false;
              confirmDeleteIcon.iconId = 0;
            }}
          />
        </div>
      )}

      {/* Confirm Batch Delete Modal */}
      {confirmBatchDelete.show && (
        <div class="modal modal-open">
          <div class="modal-box max-w-sm animate-modal-box">
            <h3 class="mb-2 text-lg font-bold">确认批量删除</h3>
            <p class="mb-4 text-gray-500">
              确定要删除选中的 {confirmBatchDelete.count}{" "}
              个图标吗？此操作不可恢复。
            </p>
            <div class="modal-action">
              <button
                class="btn"
                onClick$={() => {
                  confirmBatchDelete.show = false;
                  confirmBatchDelete.count = 0;
                }}
              >
                取消
              </button>
              <button class="btn btn-error" onClick$={doBatchDelete}>
                删除
              </button>
            </div>
          </div>
          <div
            class="modal-backdrop animate-modal-backdrop"
            onClick$={() => {
              confirmBatchDelete.show = false;
              confirmBatchDelete.count = 0;
            }}
          />
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcuts.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-md animate-modal-box">
            <h3 class="mb-4 text-lg font-bold">键盘快捷键</h3>
            <div class="space-y-2 text-sm">
              <div class="border-base-200 flex items-center justify-between border-b py-1">
                <span>搜索聚焦</span>
                <kbd class="kbd kbd-sm">/</kbd>
              </div>
              <div class="border-base-200 flex items-center justify-between border-b py-1">
                <span>全选可见图标</span>
                <span>
                  <kbd class="kbd kbd-sm">Ctrl</kbd> +{" "}
                  <kbd class="kbd kbd-sm">A</kbd>
                </span>
              </div>
              <div class="border-base-200 flex items-center justify-between border-b py-1">
                <span>删除选中图标</span>
                <kbd class="kbd kbd-sm">Delete</kbd>
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
