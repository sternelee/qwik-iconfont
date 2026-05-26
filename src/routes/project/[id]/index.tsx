import { component$, useSignal, $, useStore, useTask$, useComputed$, useOnDocument, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, useLocation, useNavigate } from "@builder.io/qwik-city";
import type { Project, Icon } from "~/lib/types";
import { generateTTFFont, generateCSS, generateSymbolSVG, generateDemoHTML } from "~/lib/font-gen";
import { SvgPreview } from "~/components/svg-preview/svg-preview";
import { ToastContainer, type ToastItem } from "~/components/toast/toast";
import { SkeletonIconCard } from "~/components/skeleton/skeleton";

export const useProject = routeLoader$(async ({ params, platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db);
  const id = parseInt(params.id, 10);

  const projectStmt = db.prepare("SELECT * FROM projects WHERE id = ?").bind(id);
  const project = await projectStmt.first<Project>();
  if (!project) throw new Error("Project not found");

  const iconsStmt = db.prepare("SELECT * FROM icons WHERE project_id = ? ORDER BY created_at ASC").bind(id);
  const iconsResult = await iconsStmt.all<Icon>();

  return { project, icons: iconsResult.results ?? [] };
});

export const useDeleteIcon = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const { getBucket } = await import("~/lib/storage");
  const db = getDB(platform);
  await initDB(db);
  const bucket = getBucket(platform);
  const id = parseInt(data.id as string, 10);

  const currentStmt = db.prepare("SELECT svg_path FROM icons WHERE id = ?").bind(id);
  const current = await currentStmt.first<{ svg_path: string }>();
  if (current) await bucket.delete(current.svg_path);

  const stmt = db.prepare("DELETE FROM icons WHERE id = ?").bind(id);
  await stmt.run();
  return { success: true };
});

export const useUpdateProject = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db);
  const id = parseInt(data.id as string, 10);

  const stmt = db.prepare("UPDATE projects SET name = ?, description = ?, font_family = ?, prefix = ? WHERE id = ?");
  stmt.bind(data.name, data.description ?? null, data.font_family ?? "iconfont", data.prefix ?? "icon-", id);
  await stmt.run();
  return { success: true };
});

export const useUpdateIcon = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db);
  const id = parseInt(data.id as string, 10);

  const stmt = db.prepare("UPDATE icons SET name = ?, unicode = ?, view_box = ? WHERE id = ?");
  stmt.bind(data.name, data.unicode ?? null, data.view_box ?? "0 0 1024 1024", id);
  await stmt.run();
  return { success: true };
});

export const useBatchRenameIcons = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db);

  const ids = (data.ids as string).split(",").map((id) => parseInt(id, 10));
  const prefix = (data.prefix as string) || "";
  const suffix = (data.suffix as string) || "";
  const find = (data.find as string) || "";
  const replace = (data.replace as string) || "";

  for (const id of ids) {
    const currentStmt = db.prepare("SELECT name FROM icons WHERE id = ?").bind(id);
    const current = await currentStmt.first<{ name: string }>();
    if (!current) continue;

    let newName = current.name;
    if (find) {
      newName = newName.split(find).join(replace);
    }
    newName = prefix + newName + suffix;
    // Clean name
    newName = newName.replace(/[^a-zA-Z0-9_-]/g, "-");

    const stmt = db.prepare("UPDATE icons SET name = ? WHERE id = ?");
    stmt.bind(newName, id);
    await stmt.run();
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
  const showPreview = useSignal(false);
  const showBatchRename = useSignal(false);
  const confirmDeleteIcon = useStore<{ show: boolean; iconId: number; iconName: string }>({ show: false, iconId: 0, iconName: "" });
  const confirmBatchDelete = useStore<{ show: boolean; count: number }>({ show: false, count: 0 });
  const editingIcon = useStore<Partial<Icon>>({});
  const previewIcon = useStore<Partial<Icon>>({});
  const codeMode = useSignal<"symbol" | "fontclass" | "unicode">("fontclass");
  const generatedCode = useSignal("");
  const searchQuery = useSignal("");
  const sortBy = useSignal<"name" | "time" | "unicode">("time");
  const copied = useSignal(false);
  const previewColor = useSignal("#333333");

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
  useVisibleTask$(({ track }) => {
    track(() => project.name);
    document.title = `${project.name} - Iconfont`;
  });

  // Keyboard shortcuts
  useOnDocument("keydown", $((ev: KeyboardEvent) => {
    // Ignore if typing in an input
    const target = ev.target as HTMLElement;
    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

    // Esc: close any open modal
    if (ev.key === "Escape") {
      if (showPreview.value) { showPreview.value = false; return; }
      if (showEdit.value) { showEdit.value = false; return; }
      if (showCode.value) { showCode.value = false; return; }
      if (showSettings.value) { showSettings.value = false; return; }
      if (showBatchRename.value) { showBatchRename.value = false; return; }
      if (confirmDeleteIcon.show) { confirmDeleteIcon.show = false; return; }
      if (confirmBatchDelete.show) { confirmBatchDelete.show = false; return; }
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
      const searchInput = document.querySelector('input[placeholder="搜索图标..."]') as HTMLInputElement;
      searchInput?.focus();
    }
  }));

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

    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".svg")) continue;
      const content = await file.text();
      const formData = new FormData();
      formData.append("name", file.name.replace(/\.svg$/i, ""));
      formData.append("content", content);

      const res = await fetch(`/api/projects/${projectId}/icons`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const result = await res.json();
        icons.list.push(result.icon);
      }
    }
    uploadLoading.value = false;
    showToast("上传完成", "success");
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
    for (const id of Array.from(selectedIds.ids)) {
      await deleteIcon.submit({ id: String(id) });
    }
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
    const idx = icons.list.findIndex((i) => i.id === editingIcon.id);
    if (idx >= 0) {
      const code = 0xe600 + idx;
      editingIcon.unicode = `&#x${code.toString(16)};`;
    }
  });

  const buildCode = $(() => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    if (selected.length === 0) return "请先选择图标";

    if (codeMode.value === "fontclass") {
      const classes = selected.map((icon) => {
        const unicode = icon.unicode || `\\${(0xe000 + icon.id).toString(16)}`;
        return `.${project.prefix}${icon.name}:before { content: "${unicode}"; }`;
      }).join("\n");
      return `@font-face {\n  font-family: "${project.font_family}";\n  src: url('${project.font_family}.ttf') format('truetype');\n}\n\n.${project.prefix} {\n  font-family: "${project.font_family}" !important;\n  font-style: normal;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n\n${classes}`;
    }

    if (codeMode.value === "symbol") {
      const symbols = selected.map((icon) => {
        const svgContent = icon.content || "";
        const viewBox = icon.view_box || "0 0 1024 1024";
        return `<symbol id="${project.prefix}${icon.name}" viewBox="${viewBox}">${svgContent.replace(/<svg[^>]*>|<\/svg>/gi, "")}</symbol>`;
      }).join("\n");
      return `<svg style="position: absolute; width: 0; height: 0; overflow: hidden;" aria-hidden="true">\n  <defs>\n    ${symbols}\n  </defs>\n</svg>`;
    }

    return selected.map((icon) => {
      const unicode = icon.unicode || `&#x${(0xe000 + icon.id).toString(16)};`;
      return `<i class="${project.prefix}" style="font-family: '${project.font_family}'">${unicode}</i>`;
    }).join("\n");
  });

  const handleDownloadFont = $(async () => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    if (selected.length === 0) { showToast("请先选择图标", "error"); return; }
    const ttf = await generateTTFFont(project.font_family, selected, project.prefix);
    if (!ttf) { showToast("字体生成失败", "error"); return; }
    const blob = new Blob([ttf], { type: "font/ttf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${project.font_family}.ttf`; a.click();
    URL.revokeObjectURL(url);
  });

  const handleDownloadPackage = $(async () => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    if (selected.length === 0) { showToast("请先选择图标", "error"); return; }
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file(`${project.font_family}.css`, generateCSS(project.font_family, project.prefix, selected));
    zip.file(`${project.font_family}-symbol.svg`, generateSymbolSVG(selected, project.prefix));
    zip.file("demo.html", generateDemoHTML(project.font_family, project.prefix, selected));
    const ttf = await generateTTFFont(project.font_family, selected, project.prefix);
    if (ttf) zip.file(`${project.font_family}.ttf`, new Uint8Array(ttf));
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url; a.download = `${project.font_family}-iconfont.zip`; a.click();
    URL.revokeObjectURL(url);
  });

  useTask$(async ({ track }) => {
    track(() => codeMode.value);
    track(() => selectedIds.ids.size);
    track(() => icons.list.length);
    generatedCode.value = await buildCode();
  });

  const copyToClipboard = $(async () => {
    await navigator.clipboard.writeText(generatedCode.value);
    copied.value = true;
    showToast("代码已复制到剪贴板", "success");
    setTimeout(() => copied.value = false, 2000);
  });

  const displayList = filteredIcons.value;

  return (
    <div class="min-h-screen bg-base-200">
      <ToastContainer toasts={toasts.items} />

      {/* Header */}
      <div class="navbar bg-base-100 shadow-sm px-4">
        <div class="flex-none">
          <button class="btn btn-ghost btn-sm gap-1" onClick$={() => nav("/")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            返回
          </button>
        </div>
        <div class="flex-1 px-4 min-w-0">
          <h1 class="text-xl font-bold truncate">{project.name}</h1>
          <p class="text-xs text-gray-500">{icons.list.length} 个图标 · Font: {project.font_family}</p>
        </div>
        {/* Desktop actions */}
        <div class="hidden md:flex flex-none gap-2 flex-wrap justify-end">
          <button class="btn btn-outline btn-sm" onClick$={() => showSettings.value = true}>项目设置</button>
          <button class="btn btn-outline btn-sm" onClick$={handleDownloadFont}>下载字体</button>
          <button class="btn btn-primary btn-sm" onClick$={async () => { showCode.value = true; generatedCode.value = await buildCode(); }}>生成代码</button>
          <button class="btn btn-secondary btn-sm" onClick$={handleDownloadPackage}>打包下载</button>
        </div>
        {/* Mobile actions dropdown */}
        <div class="dropdown dropdown-end md:hidden">
          <button tabIndex={0} class="btn btn-ghost btn-sm btn-square">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
          <ul tabIndex={0} class="dropdown-content menu z-[1] p-2 shadow bg-base-100 rounded-box w-40">
            <li><button onClick$={() => showSettings.value = true}>项目设置</button></li>
            <li><button onClick$={handleDownloadFont}>下载字体</button></li>
            <li><button onClick$={async () => { showCode.value = true; generatedCode.value = await buildCode(); }}>生成代码</button></li>
            <li><button onClick$={handleDownloadPackage}>打包下载</button></li>
          </ul>
        </div>
      </div>

      {/* Toolbar */}
      <div class="container mx-auto px-4 py-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div class="flex items-center gap-3">
            <label class="label cursor-pointer gap-2">
              <input type="checkbox" class="checkbox checkbox-sm" checked={displayList.length > 0 && displayList.every((i) => selectedIds.ids.has(i.id))} onChange$={selectAll} />
              <span class="label-text text-sm">全选 ({selectedIds.ids.size}/{icons.list.length})</span>
            </label>
            {selectedIds.ids.size > 0 && (
              <>
                <button class="btn btn-error btn-sm" onClick$={() => {
                  confirmBatchDelete.count = selectedIds.ids.size;
                  confirmBatchDelete.show = true;
                }}>删除选中</button>
                <button class="btn btn-outline btn-sm" onClick$={() => showBatchRename.value = true}>批量重命名</button>
              </>
            )}
          </div>
          <div class="flex gap-2">
            <div class="relative">
              <input type="file" accept=".svg" multiple class="absolute inset-0 opacity-0 cursor-pointer z-10" onChange$={(ev: any) => handleFileUpload(ev.target.files)} />
              <button class="btn btn-primary btn-sm gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                {uploadLoading.value ? "上传中..." : "上传图标"}
              </button>
            </div>
          </div>
        </div>

        {/* Search & Sort */}
        <div class="flex flex-wrap gap-2 mb-3">
          <div class="flex-1 min-w-[200px]">
            <div class="relative">
              <input type="text" class="input input-bordered input-sm w-full pl-9" placeholder="搜索图标..." value={searchQuery.value} onInput$={(ev: any) => searchQuery.value = ev.target.value} />
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
            </div>
          </div>
          <select class="select select-bordered select-sm" onChange$={(ev: any) => sortBy.value = ev.target.value}>
            <option value="time">按时间排序</option>
            <option value="name">按名称排序</option>
            <option value="unicode">按Unicode排序</option>
          </select>
        </div>

        {/* Drop zone */}
        <div
          class={`relative p-8 border-2 border-dashed rounded-xl text-center transition-all duration-200 ${dragOver.value ? "border-primary bg-primary/5 text-primary scale-[1.01] shadow-lg" : "border-base-300 text-gray-500 hover:border-primary/50 hover:bg-base-100"}`}
          onDragOver$={(ev: any) => { ev.preventDefault(); dragOver.value = true; }}
          onDragLeave$={() => dragOver.value = false}
          onDrop$={(ev: any) => { ev.preventDefault(); handleFileUpload(ev.dataTransfer.files); }}
        >
          <div class={`transition-transform duration-200 ${dragOver.value ? "scale-110" : ""}`}>
            <svg class="mx-auto mb-3 text-current" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
            <p class="font-medium">{dragOver.value ? "松开鼠标上传 SVG 文件" : "拖拽 SVG 文件到此处上传"}</p>
            <p class="text-xs mt-1 opacity-70">或点击上方「上传图标」按钮</p>
          </div>
        </div>
      </div>

      {/* Icons Grid */}
      <div class="container mx-auto px-4 pb-8">
        {displayList.length === 0 ? (
          <div class="card bg-base-100 shadow">
            <div class="card-body items-center text-center py-12">
              <svg class="text-gray-300 mb-3" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <p class="text-gray-500">{searchQuery.value ? "未找到匹配的图标" : "暂无图标，请上传 SVG 文件"}</p>
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {/* Skeleton cards shown while uploading */}
            {uploadLoading.value && (
              <>
                <SkeletonIconCard />
                <SkeletonIconCard />
                <SkeletonIconCard />
              </>
            )}
            {displayList.map((icon) => (
              <div
                key={icon.id}
                class={`card bg-base-100 shadow hover:shadow-lg transition-all group ${selectedIds.ids.has(icon.id) ? "ring-2 ring-primary bg-primary/5" : ""}`}
              >
                <div class="card-body p-3 items-center text-center relative">
                  {/* Selection checkbox */}
                  <button
                    class={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.ids.has(icon.id) ? "bg-primary border-primary" : "border-base-300 bg-base-100 hover:border-primary"}`}
                    onClick$={() => toggleSelect(icon.id)}
                    title={selectedIds.ids.has(icon.id) ? "取消选择" : "选择"}
                  >
                    {selectedIds.ids.has(icon.id) && (
                      <svg class="text-white w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                  {/* Preview click area */}
                  <button
                    class="w-14 h-14 flex items-center justify-center mt-1 hover:scale-110 transition-transform"
                    onClick$={() => { previewIcon.id = icon.id; previewIcon.name = icon.name; previewIcon.content = icon.content; previewIcon.unicode = icon.unicode; showPreview.value = true; }}
                    title="点击预览"
                  >
                    {icon.content ? (
                      <SvgPreview content={icon.content} class="w-full h-full" />
                    ) : (
                      <span class="text-xs text-gray-400">无预览</span>
                    )}
                  </button>
                  <p class="text-xs truncate w-full font-medium" title={icon.name}>{icon.name}</p>
                  {icon.unicode && <span class="text-[10px] text-gray-400 font-mono">{icon.unicode}</span>}
                  {/* Action buttons */}
                  <div class="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="btn btn-ghost btn-xs btn-square" title="编辑" onClick$={() => { editingIcon.id = icon.id; editingIcon.name = icon.name; editingIcon.unicode = icon.unicode; editingIcon.view_box = icon.view_box; editingIcon.content = icon.content; showEdit.value = true; }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-xs btn-square" title="下载 SVG" onClick$={() => { const blob = new Blob([icon.content || ""], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${icon.name}.svg`; a.click(); URL.revokeObjectURL(url); showToast(`已下载 ${icon.name}.svg`, "success"); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-xs btn-square text-error" title="删除" onClick$={() => handleDelete(icon.id, icon.name)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
          <div class="modal-box max-w-lg">
            <h3 class="font-bold text-lg mb-4">项目设置</h3>
            <form onSubmit$={async (ev: any) => { ev.preventDefault(); const fd = new FormData(ev.target); await updateProject.submit({ id: loc.params.id, name: fd.get("name"), description: fd.get("description"), font_family: fd.get("font_family"), prefix: fd.get("prefix") }); project.name = fd.get("name") as string; project.description = fd.get("description") as string; project.font_family = fd.get("font_family") as string; project.prefix = fd.get("prefix") as string; showSettings.value = false; }}>
              <div class="form-control mb-3"><label class="label"><span class="label-text">项目名称</span></label><input name="name" type="text" class="input input-bordered" value={project.name} required /></div>
              <div class="form-control mb-3"><label class="label"><span class="label-text">描述</span></label><input name="description" type="text" class="input input-bordered" value={project.description || ""} /></div>
              <div class="form-control mb-3"><label class="label"><span class="label-text">Font Family</span></label><input name="font_family" type="text" class="input input-bordered" value={project.font_family} /></div>
              <div class="form-control mb-4"><label class="label"><span class="label-text">Class 前缀</span></label><input name="prefix" type="text" class="input input-bordered" value={project.prefix} /></div>
              <div class="modal-action"><button type="button" class="btn" onClick$={() => showSettings.value = false}>取消</button><button type="submit" class="btn btn-primary">保存</button></div>
            </form>
          </div>
          <div class="modal-backdrop" onClick$={() => showSettings.value = false} />
        </div>
      )}

      {/* Preview Icon Modal */}
      {showPreview.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-sm text-center">
            <h3 class="font-bold text-lg mb-4">{previewIcon.name}</h3>
            <div class="w-32 h-32 mx-auto mb-4 bg-base-200 rounded-lg flex items-center justify-center p-4">
              {previewIcon.content && <SvgPreview content={previewIcon.content} class="w-full h-full" color={previewColor.value} />}
            </div>
            {/* Color picker */}
            <div class="flex items-center justify-center gap-2 mb-4">
              {["#333333", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899"].map((c) => (
                <button
                  key={c}
                  type="button"
                  class={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${previewColor.value === c ? "border-primary scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick$={() => (previewColor.value = c)}
                  title={c}
                />
              ))}
              <input
                type="color"
                class="w-6 h-6 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                value={previewColor.value}
                onInput$={(ev: any) => (previewColor.value = ev.target.value)}
              />
            </div>
            {previewIcon.unicode && <p class="text-sm text-gray-500 font-mono mb-4">{previewIcon.unicode}</p>}
            <div class="modal-action justify-center"><button class="btn" onClick$={() => showPreview.value = false}>关闭</button></div>
          </div>
          <div class="modal-backdrop" onClick$={() => showPreview.value = false} />
        </div>
      )}

      {/* Edit Icon Modal */}
      {showEdit.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-lg">
            <h3 class="font-bold text-lg mb-4">编辑图标</h3>
            <div class="flex gap-4">
              <div class="flex flex-col items-center gap-2 flex-shrink-0">
                <div class="w-24 h-24 bg-base-200 rounded-lg flex items-center justify-center p-3">
                  {editingIcon.content && <SvgPreview content={editingIcon.content} class="w-full h-full" color={previewColor.value} />}
                </div>
                <div class="flex items-center gap-1">
                  {["#333333", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      class={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${previewColor.value === c ? "border-primary scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      onClick$={() => (previewColor.value = c)}
                    />
                  ))}
                  <input
                    type="color"
                    class="w-4 h-4 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                    value={previewColor.value}
                    onInput$={(ev: any) => (previewColor.value = ev.target.value)}
                  />
                </div>
              </div>
              <form class="flex-1" onSubmit$={async (ev: any) => { ev.preventDefault(); const fd = new FormData(ev.target); const iconId = editingIcon.id; await updateIcon.submit({ id: String(iconId), name: fd.get("name"), unicode: fd.get("unicode") || null, view_box: fd.get("view_box") || "0 0 1024 1024" }); const idx = icons.list.findIndex((i) => i.id === iconId); if (idx >= 0) icons.list[idx] = { ...icons.list[idx], name: fd.get("name") as string, unicode: fd.get("unicode") as string || null, view_box: fd.get("view_box") as string }; showEdit.value = false; }}>
                <div class="form-control mb-3"><label class="label"><span class="label-text">图标名称</span></label><input name="name" type="text" class="input input-bordered" value={editingIcon.name} required /></div>
                <div class="form-control mb-3">
                  <label class="label"><span class="label-text">Unicode</span></label>
                  <div class="flex gap-2">
                    <input name="unicode" type="text" class="input input-bordered flex-1" value={editingIcon.unicode || ""} placeholder="例如: &#xe600;" />
                    <button type="button" class="btn btn-outline btn-sm" onClick$={autoUnicode}>自动生成</button>
                  </div>
                </div>
                <div class="form-control mb-4"><label class="label"><span class="label-text">ViewBox</span></label><input name="view_box" type="text" class="input input-bordered" value={editingIcon.view_box || "0 0 1024 1024"} /></div>
                <div class="modal-action"><button type="button" class="btn" onClick$={() => showEdit.value = false}>取消</button><button type="submit" class="btn btn-primary">保存</button></div>
              </form>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => showEdit.value = false} />
        </div>
      )}

      {/* Code Generation Modal */}
      {showCode.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-3xl">
            <h3 class="font-bold text-lg mb-4">生成代码</h3>
            <div class="tabs tabs-boxed mb-4">
              <button class={`tab ${codeMode.value === "fontclass" ? "tab-active" : ""}`} onClick$={() => codeMode.value = "fontclass"}>Font Class</button>
              <button class={`tab ${codeMode.value === "symbol" ? "tab-active" : ""}`} onClick$={() => codeMode.value = "symbol"}>Symbol</button>
              <button class={`tab ${codeMode.value === "unicode" ? "tab-active" : ""}`} onClick$={() => codeMode.value = "unicode"}>Unicode</button>
            </div>

            {/* Font preview for fontclass mode */}
            {codeMode.value === "fontclass" && selectedIds.ids.size > 0 && (
              <div class="mb-4 p-4 bg-base-200 rounded-lg">
                <p class="text-xs text-gray-500 mb-2">预览效果</p>
                <div class="flex flex-wrap gap-3">
                  {icons.list.filter((i) => selectedIds.ids.has(i.id)).slice(0, 8).map((icon) => (
                    <div key={icon.id} class="flex flex-col items-center gap-1">
                      <SvgPreview content={icon.content} class="w-6 h-6" />
                      <span class="text-[10px] text-gray-400">{icon.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div class="bg-base-300 rounded-lg p-4 relative group">
              <pre class="text-sm overflow-auto max-h-80 whitespace-pre-wrap"><code>{generatedCode.value}</code></pre>
              <button class={`absolute top-2 right-2 btn btn-xs ${copied.value ? "btn-success" : "btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"}`} onClick$={copyToClipboard}>
                {copied.value ? "已复制!" : "复制"}
              </button>
            </div>
            <div class="modal-action">
              <button class="btn btn-primary" onClick$={() => { const code = generatedCode.value; if (!code) return; const blob = new Blob([code], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `iconfont-${codeMode.value}.txt`; a.click(); URL.revokeObjectURL(url); }}>下载代码</button>
              <button class="btn" onClick$={() => showCode.value = false}>关闭</button>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => showCode.value = false} />
        </div>
      )}

      {/* Batch Rename Modal */}
      {showBatchRename.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-lg">
            <h3 class="font-bold text-lg mb-4">批量重命名 ({selectedIds.ids.size} 个图标)</h3>
            <form onSubmit$={async (ev: any) => {
              ev.preventDefault();
              const fd = new FormData(ev.target);
              const ids = Array.from(selectedIds.ids).join(",");
              await batchRenameIcons.submit({
                ids,
                prefix: fd.get("prefix") as string,
                suffix: fd.get("suffix") as string,
                find: fd.get("find") as string,
                replace: fd.get("replace") as string,
              });
              // Update local state
              const prefix = (fd.get("prefix") as string) || "";
              const suffix = (fd.get("suffix") as string) || "";
              const find = (fd.get("find") as string) || "";
              const replace = (fd.get("replace") as string) || "";
              for (let i = 0; i < icons.list.length; i++) {
                const icon = icons.list[i];
                if (!selectedIds.ids.has(icon.id)) continue;
                let newName = icon.name;
                if (find) newName = newName.split(find).join(replace);
                newName = prefix + newName + suffix;
                newName = newName.replace(/[^a-zA-Z0-9_-]/g, "-");
                icons.list[i] = { ...icon, name: newName };
              }
              showBatchRename.value = false;
            }}>
              <div class="grid grid-cols-2 gap-3 mb-3">
                <div class="form-control">
                  <label class="label"><span class="label-text">前缀</span></label>
                  <input name="prefix" type="text" class="input input-bordered input-sm" placeholder="例如: icon-" />
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">后缀</span></label>
                  <input name="suffix" type="text" class="input input-bordered input-sm" placeholder="例如: -new" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="form-control">
                  <label class="label"><span class="label-text">查找</span></label>
                  <input name="find" type="text" class="input input-bordered input-sm" placeholder="要替换的文本" />
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text">替换为</span></label>
                  <input name="replace" type="text" class="input input-bordered input-sm" placeholder="新文本" />
                </div>
              </div>
              <div class="modal-action">
                <button type="button" class="btn" onClick$={() => showBatchRename.value = false}>取消</button>
                <button type="submit" class="btn btn-primary">应用</button>
              </div>
            </form>
          </div>
          <div class="modal-backdrop" onClick$={() => showBatchRename.value = false} />
        </div>
      )}

      {/* Confirm Delete Icon Modal */}
      {confirmDeleteIcon.show && (
        <div class="modal modal-open">
          <div class="modal-box max-w-sm">
            <h3 class="font-bold text-lg mb-2">确认删除</h3>
            <p class="text-gray-500 mb-4">
              确定要删除图标 "{confirmDeleteIcon.iconName}" 吗？此操作不可恢复。
            </p>
            <div class="modal-action">
              <button class="btn" onClick$={() => { confirmDeleteIcon.show = false; confirmDeleteIcon.iconId = 0; }}>取消</button>
              <button class="btn btn-error" onClick$={doDeleteIcon}>删除</button>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => { confirmDeleteIcon.show = false; confirmDeleteIcon.iconId = 0; }} />
        </div>
      )}

      {/* Confirm Batch Delete Modal */}
      {confirmBatchDelete.show && (
        <div class="modal modal-open">
          <div class="modal-box max-w-sm">
            <h3 class="font-bold text-lg mb-2">确认批量删除</h3>
            <p class="text-gray-500 mb-4">
              确定要删除选中的 {confirmBatchDelete.count} 个图标吗？此操作不可恢复。
            </p>
            <div class="modal-action">
              <button class="btn" onClick$={() => { confirmBatchDelete.show = false; confirmBatchDelete.count = 0; }}>取消</button>
              <button class="btn btn-error" onClick$={doBatchDelete}>删除</button>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => { confirmBatchDelete.show = false; confirmBatchDelete.count = 0; }} />
        </div>
      )}
    </div>
  );
});
