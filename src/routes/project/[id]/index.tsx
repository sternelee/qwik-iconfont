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
import { SvgEditor } from "~/components/svg-editor/svg-editor";
import { IconDetailPanel } from "~/components/icon-detail/icon-detail";
import { parseTags, resolveSvgViewBox } from "~/lib/types";
import { getSessionFromRequest } from "~/lib/session";
import {
  getLocalProject,
  getLocalIcons,
  createLocalIcon,
  deleteLocalIcon,
  updateLocalIcon,
  type LocalProject,
  type LocalIcon,
} from "~/lib/local-storage";

type ProjectLoadResult =
  | { mode: "server"; project: Project; icons: Icon[] }
  | { mode: "local"; project: LocalProject | null; icons: LocalIcon[] };

export const useProject = routeLoader$(
  async ({ params, platform, request }): Promise<ProjectLoadResult> => {
    const id = parseInt(params.id, 10);
    const session = await getSessionFromRequest(platform, request);

    if (session) {
      const { getDB, initDB } = await import("~/lib/db");
      const db = getDB(platform);
      await initDB(db, platform);
      const { projects, icons } = await import("~/lib/schema");
      const { eq, and } = await import("drizzle-orm");

      const projectResult = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.user_id, session.user.id)));
      const project = projectResult[0] as Project | undefined;
      if (!project) throw new Error("Project not found");

      const iconsResult = await db
        .select()
        .from(icons)
        .where(eq(icons.project_id, id))
        .orderBy(icons.created_at);

      return { mode: "server", project, icons: iconsResult as Icon[] };
    }

    return { mode: "local", project: null, icons: [] };
  },
);

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
      view_box: resolveSvgViewBox(
        data.view_box as string | undefined,
        content ?? current.content,
      ),
      content: content ?? current.content,
      svg_path: svgPath,
      tags: (data.tags as string | undefined) ?? current.tags ?? null,
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
    newName = newName.replace(/[^a-zA-Z0-9_-]/g, "-");

    await db.update(icons).set({ name: newName }).where(eq(icons.id, icon.id));
  }

  return { success: true };
});

export const useBatchUpdateTags = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db, platform);
  const { icons } = await import("~/lib/schema");
  const { eq, inArray } = await import("drizzle-orm");

  const ids = (data.ids as string).split(",").map((id) => parseInt(id, 10));
  const action = data.action as "add" | "remove" | "set";
  const newTags = (data.tags as string).split(",").filter(Boolean);

  const iconsResult = await db
    .select()
    .from(icons)
    .where(inArray(icons.id, ids));

  for (const icon of iconsResult) {
    const existing = icon.tags
      ? icon.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    let finalTags: string[];
    if (action === "add") {
      finalTags = [...new Set([...existing, ...newTags])];
    } else if (action === "remove") {
      finalTags = existing.filter((t) => !newTags.includes(t));
    } else {
      finalTags = newTags;
    }
    const tagsStr = finalTags.join(",");
    await db
      .update(icons)
      .set({ tags: tagsStr || null })
      .where(eq(icons.id, icon.id));
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
  const batchUpdateTags = useBatchUpdateTags();

  const isLocal = data.value.mode === "local";
  const localLoaded = useSignal(false);

  const project = useStore<any>(
    data.value.project
      ? { ...data.value.project }
      : {
          id: 0,
          name: "",
          description: null,
          font_family: "iconfont",
          prefix: "icon-",
          created_at: "",
          updated_at: "",
        },
  );
  const icons = useStore<{ list: any[] }>({
    list: [...(data.value.icons || [])],
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (isLocal) {
      const id = parseInt(loc.params.id, 10);
      const localProject = getLocalProject(id);
      if (localProject) {
        Object.assign(project, localProject);
        icons.list = getLocalIcons(id);
      } else {
        nav("/");
      }
      localLoaded.value = true;
    }
  });

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
  const validSort = ["name", "time", "unicode"] as const;
  const sortParam = loc.url.searchParams.get("sort");
  const sortBy = useSignal<"name" | "time" | "unicode">(
    validSort.includes(sortParam as any)
      ? (sortParam as "name" | "time" | "unicode")
      : "time",
  );
  const copied = useSignal(false);
  const previewColor = useSignal("#E11D48");
  const downloadLoading = useSignal<"font" | "package" | null>(null);
  const showShortcuts = useSignal(false);
  const fontPreviewBase64 = useSignal("");

  // Enhanced features state
  const showSvgEditor = useSignal(false);
  const showIconDetail = useSignal(false);
  const showBatchTag = useSignal(false);
  const activeTag = useSignal<string | null>(null);
  const gridSize = useSignal<"small" | "medium" | "large">("medium");
  const selectedIconForEdit = useStore<Partial<Icon>>({});
  const batchTagForm = useStore({
    action: "add" as "add" | "remove" | "set",
    tags: "",
  });
  const allTags = useComputed$(() => {
    const tagSet = new Set<string>();
    icons.list.forEach((icon) => {
      const tags = parseTags(icon.tags);
      tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  });

  const tagCounts = useComputed$(() => {
    const counts: Record<string, number> = {};
    icons.list.forEach((icon) => {
      const tags = parseTags(icon.tags);
      tags.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
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
      const target = ev.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      )
        return;

      if (ev.key === "Escape") {
        if (showShortcuts.value) { showShortcuts.value = false; return; }
        if (showPreview.value) { showPreview.value = false; return; }
        if (showEdit.value) { showEdit.value = false; return; }
        if (showCode.value) { showCode.value = false; return; }
        if (showSettings.value) { showSettings.value = false; return; }
        if (showBatchRename.value) { showBatchRename.value = false; return; }
        if (confirmDeleteIcon.show) { confirmDeleteIcon.show = false; return; }
        if (confirmBatchDelete.show) { confirmBatchDelete.show = false; return; }
        if (showSvgEditor.value) { showSvgEditor.value = false; return; }
        if (showIconDetail.value) { showIconDetail.value = false; return; }
        if (showBatchTag.value) { showBatchTag.value = false; return; }
      }

      if (ev.key === "?" && !ev.shiftKey) {
        showShortcuts.value = true;
        return;
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key === "a") {
        ev.preventDefault();
        selectAll();
        return;
      }

      if (ev.key === "Delete" && selectedIds.ids.size > 0) {
        const visible = filteredIcons.value.map((i) => i.id);
        const selectedVisible = visible.filter((id) => selectedIds.ids.has(id));
        if (selectedVisible.length > 0) {
          confirmBatchDelete.count = selectedIds.ids.size;
          confirmBatchDelete.show = true;
        }
        return;
      }

      if (ev.key === "/") {
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
    if (activeTag.value) {
      list = list.filter((i) => {
        const tags = i.tags
          ? i.tags.split(",").map((t: string) => t.trim())
          : [];
        return tags.includes(activeTag.value!);
      });
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
    const projectId = parseInt(loc.params.id, 10);

    const svgFiles = Array.from(files).filter(
      (file) => file.name.endsWith(".svg") || file.type === "image/svg+xml",
    );
    const skipped = files.length - svgFiles.length;

    const uploadOne = async (file: File) => {
      const content = await file.text();
      const cleanName = file.name.replace(/\.svg$/i, "");

      if (isLocal) {
        const icon = createLocalIcon(projectId, {
          name: cleanName,
          content,
        });
        return icon as any;
      }

      const formData = new FormData();
      formData.append("name", cleanName);
      formData.append("content", content);
      const res = await fetch(`/api/projects/${projectId}/icons`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const result = (await res.json()) as { icon: Icon };
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
    const projectId = parseInt(loc.params.id, 10);
    confirmDeleteIcon.show = false;

    if (isLocal) {
      deleteLocalIcon(projectId, iconId);
    } else {
      await deleteIcon.submit({ id: String(iconId) });
    }

    icons.list = icons.list.filter((i) => i.id !== iconId);
    const next = new Set(selectedIds.ids);
    next.delete(iconId);
    selectedIds.ids = next;
    showToast(`图标 "${confirmDeleteIcon.iconName}" 已删除`, "success");
  });

  const doBatchDelete = $(async () => {
    const count = confirmBatchDelete.count;
    const projectId = parseInt(loc.params.id, 10);
    confirmBatchDelete.show = false;

    if (isLocal) {
      Array.from(selectedIds.ids).forEach((id) =>
        deleteLocalIcon(projectId, id),
      );
    } else {
      await Promise.all(
        Array.from(selectedIds.ids).map((id) =>
          deleteIcon.submit({ id: String(id) }),
        ),
      );
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
  const hasUnicodeCount = icons.list.filter((i) => i.unicode).length;

  return (
    <div class="hero-gradient min-h-screen">
      <ToastContainer toasts={toasts.items} />

      {/* ── Navbar ────────────────────────────────────────────── */}
      <header class="clay-navbar sticky top-0 z-30">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Left: Breadcrumb */}
          <div class="flex items-center gap-3">
            <button
              class="flex h-9 w-9 items-center justify-center rounded-2xl text-rose-500 transition-all hover:bg-rose-50"
              onClick$={() => nav("/")}
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
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div class="h-6 w-px bg-rose-200" />
            <div class="flex items-center gap-2.5">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-rose-500 text-white shadow-md shadow-rose-500/20">
                <span class="font-['Nunito'] text-sm font-bold">
                  {project.name ? project.name.charAt(0).toUpperCase() : "P"}
                </span>
              </div>
              <div class="hidden min-w-0 sm:block">
                <h1 class="font-['Nunito'] max-w-[200px] truncate text-base font-bold text-rose-950">
                  {project.name}
                </h1>
                <p class="text-[11px] text-rose-400/70">
                  {icons.list.length} 个图标 · {project.font_family}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div class="flex items-center gap-2">
            {/* Desktop actions */}
            <div class="hidden flex-wrap items-center gap-2 md:flex">
              <button
                class="rounded-2xl px-4 py-2 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50"
                onClick$={() => (showSettings.value = true)}
              >
                项目设置
              </button>
              <button
                class="clay-button flex items-center gap-1.5 rounded-2xl bg-rose-500 px-4 py-2 text-sm font-bold text-white"
                onClick$={handleDownloadFont}
                disabled={
                  selectedIds.ids.size === 0 || downloadLoading.value === "font"
                }
              >
                {downloadLoading.value === "font" ? (
                  <span class="loading loading-spinner loading-xs" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                )}
                下载字体
              </button>
              <button
                class="clay-button flex items-center gap-1.5 rounded-2xl bg-rose-500 px-4 py-2 text-sm font-bold text-white"
                onClick$={async () => {
                  showCode.value = true;
                  generatedCode.value = await buildCode();
                }}
                disabled={selectedIds.ids.size === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                生成代码
              </button>
              <button
                class="clay-button-secondary flex items-center gap-1.5 rounded-2xl bg-blue-500 px-4 py-2 text-sm font-bold text-white"
                onClick$={handleDownloadPackage}
                disabled={
                  selectedIds.ids.size === 0 ||
                  downloadLoading.value === "package"
                }
              >
                {downloadLoading.value === "package" ? (
                  <span class="loading loading-spinner loading-xs" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                )}
                打包下载
              </button>
            </div>
            {/* Mobile actions */}
            <div class="dropdown dropdown-end md:hidden">
              <button tabIndex={0} class="flex h-9 w-9 items-center justify-center rounded-2xl text-rose-600 transition-all hover:bg-rose-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
              <ul tabIndex={0} class="dropdown-content clay-card z-[1] mt-2 w-44 p-2">
                <li><button class="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-800 transition-all hover:bg-rose-50" onClick$={() => (showSettings.value = true)}>项目设置</button></li>
                <li><button class="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-800 transition-all hover:bg-rose-50" onClick$={handleDownloadFont} disabled={selectedIds.ids.size === 0 || downloadLoading.value === "font"}>下载字体</button></li>
                <li><button class="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-800 transition-all hover:bg-rose-50" onClick$={async () => { showCode.value = true; generatedCode.value = await buildCode(); }} disabled={selectedIds.ids.size === 0}>生成代码</button></li>
                <li><button class="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-800 transition-all hover:bg-rose-50" onClick$={handleDownloadPackage} disabled={selectedIds.ids.size === 0 || downloadLoading.value === "package"}>打包下载</button></li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      {/* ── Project Catalog Preview ───────────────────────────── */}
      <section class="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div class="animate-fade-in-up clay-card p-6">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* Project info */}
            <div class="flex items-center gap-4">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-500 text-2xl font-extrabold text-white shadow-lg shadow-rose-500/20">
                {project.name ? project.name.charAt(0).toUpperCase() : "P"}
              </div>
              <div>
                <h2 class="font-['Nunito'] text-xl font-extrabold text-rose-950">{project.name}</h2>
                {project.description && (
                  <p class="mt-0.5 max-w-md text-sm text-rose-700/60">{project.description}</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div class="flex flex-wrap items-center gap-3">
              {[
                { label: "图标", value: icons.list.length, icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" },
                { label: "Unicode", value: hasUnicodeCount, icon: "M9.5 3A6.5 6.5 0 0 0 3 9.5c0 4.1 2.97 7.5 6.84 7.5h.67c.3 0 .58-.18.7-.45l1.18-2.63c.13-.28.4-.46.7-.46h2.02c.3 0 .57.18.7.46l1.18 2.63c.12.27.4.45.7.45h.67C17.03 17 20 13.6 20 9.5A6.5 6.5 0 0 0 13.5 3h-4z" },
                { label: "标签", value: allTags.value.length, icon: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" },
                { label: "已选", value: selectedIds.ids.size, icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14" },
              ].map((stat) => (
                <div key={stat.label} class="clay-inset flex items-center gap-2.5 px-4 py-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-rose-400"><path d={stat.icon} /></svg>
                  <div>
                    <p class="font-['Nunito'] text-lg font-extrabold leading-none text-rose-950">{stat.value}</p>
                    <p class="text-[10px] font-medium text-rose-400/70">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div class="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-wrap items-center gap-2">
            <label class="label cursor-pointer gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-sm rounded-lg border-rose-200 [--chkbg:theme(colors.rose.500)]"
                checked={
                  displayList.length > 0 &&
                  displayList.every((i) => selectedIds.ids.has(i.id))
                }
                onChange$={selectAll}
              />
              <span class="label-text text-sm font-medium text-rose-800">
                全选 ({selectedIds.ids.size}/{icons.list.length})
              </span>
            </label>
            {selectedIds.ids.size > 0 && (
              <>
                <button
                  class="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 transition-all hover:bg-rose-100"
                  onClick$={() => {
                    confirmBatchDelete.count = selectedIds.ids.size;
                    confirmBatchDelete.show = true;
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  删除选中
                </button>
                <button
                  class="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 transition-all hover:bg-rose-100"
                  onClick$={() => (showBatchRename.value = true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  批量重命名
                </button>
                <button
                  class="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 transition-all hover:bg-rose-100"
                  onClick$={() => (showBatchTag.value = true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" x2="7.01" y1="7" y2="7"/></svg>
                  批量标签
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
              <button class="clay-button flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                {uploadLoading.value ? "上传中..." : "上传图标"}
              </button>
            </div>
          </div>
        </div>

        {/* Search & Sort */}
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <div class="min-w-[200px] flex-1">
            <div class="relative">
              <input
                type="text"
                class="input-clay w-full py-2.5 pr-8 pl-10 text-sm"
                placeholder="搜索图标..."
                value={searchQuery.value}
                onInput$={(ev: any) => (searchQuery.value = ev.target.value)}
              />
              <svg class="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-rose-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
              {searchQuery.value && (
                <button class="absolute top-1/2 right-3 -translate-y-1/2 text-rose-300 transition-all hover:text-rose-500" onClick$={() => (searchQuery.value = "")} title="清除搜索">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
                </button>
              )}
            </div>
          </div>
          <select
            class="input-clay px-3 py-2.5 text-sm"
            value={sortBy.value}
            onChange$={(ev: any) => (sortBy.value = ev.target.value)}
          >
            <option value="time">按时间排序</option>
            <option value="name">按名称排序</option>
            <option value="unicode">按Unicode排序</option>
          </select>
          <span class="text-xs font-medium text-rose-400/60">
            {displayList.length} / {icons.list.length}
          </span>
          {/* Grid size */}
          <div class="flex items-center gap-1 rounded-2xl bg-white/60 p-1 backdrop-blur-sm">
            {(["small", "medium", "large"] as const).map((size) => (
              <button
                key={size}
                class={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all ${gridSize.value === size ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "text-rose-400 hover:bg-rose-50"}`}
                onClick$={() => (gridSize.value = size)}
                title={size === "small" ? "小图标" : size === "medium" ? "中图标" : "大图标"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width={size === "small" ? "12" : size === "medium" ? "14" : "16"} height={size === "small" ? "12" : size === "medium" ? "14" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
            ))}
          </div>
        </div>

        {/* Tag filter */}
        {allTags.value.length > 0 && (
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-rose-400/70">标签:</span>
            <button
              class={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${activeTag.value === null ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "bg-white/60 text-rose-600 hover:bg-rose-50"}`}
              onClick$={() => (activeTag.value = null)}
            >
              全部
            </button>
            {allTags.value.map((tag) => (
              <button
                key={tag}
                class={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${activeTag.value === tag ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "bg-white/60 text-rose-600 hover:bg-rose-50"}`}
                onClick$={() =>
                  (activeTag.value = activeTag.value === tag ? null : tag)
                }
              >
                {tag}
                <span class={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${activeTag.value === tag ? "bg-white/20" : "bg-rose-100"}`}>
                  {tagCounts.value[tag] || 0}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Drop zone */}
        <div
          class={`relative rounded-3xl border-2 border-dashed p-8 text-center transition-all duration-300 ${dragOver.value ? "border-rose-400 bg-rose-50/50 text-rose-600 animate-drop-pulse scale-[1.01]" : "border-rose-200/60 text-rose-400/60 hover:border-rose-300 hover:bg-white/40"}`}
          onDragOver$={(ev: any) => { ev.preventDefault(); dragOver.value = true; }}
          onDragLeave$={() => (dragOver.value = false)}
          onDrop$={(ev: any) => { ev.preventDefault(); handleFileUpload(ev.dataTransfer.files); }}
        >
          <div class={`transition-transform duration-300 ${dragOver.value ? "scale-110" : ""}`}>
            <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-rose-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </div>
            <p class="font-['Nunito'] font-bold text-rose-800">
              {dragOver.value ? "松开鼠标上传 SVG 文件" : "拖拽 SVG 文件到此处上传"}
            </p>
            <p class="mt-1 text-xs text-rose-400/60">或点击上方「上传图标」按钮</p>
          </div>
        </div>
      </div>

      {/* ── Icons Grid ────────────────────────────────────────── */}
      <div class="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6">
        {/* Stats strip */}
        {icons.list.length > 0 && (
          <div class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span class="text-rose-400/60">共 {icons.list.length} 个图标</span>
            {selectedIds.ids.size > 0 && (
              <span class="font-semibold text-rose-500">{selectedIds.ids.size} 个已选中</span>
            )}
            <span class="text-rose-400/60">{hasUnicodeCount} 个含 Unicode</span>
            {allTags.value.length > 0 && (
              <span class="text-rose-400/60">{allTags.value.length} 个标签</span>
            )}
            {activeTag.value && (
              <span class="text-rose-400/60">· 当前筛选: <strong class="text-rose-600">{activeTag.value}</strong> ({displayList.length} 个)</span>
            )}
          </div>
        )}

        {displayList.length === 0 ? (
          <div class="animate-fade-in-up clay-card flex flex-col items-center py-16">
            <div class="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-100 to-pink-100">
              <svg class="h-10 w-10 text-rose-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <p class="font-['Nunito'] text-base font-bold text-rose-800">
              {searchQuery.value ? "未找到匹配的图标" : "暂无图标，请上传 SVG 文件"}
            </p>
            <p class="mt-1 text-sm text-rose-400/60">
              {searchQuery.value ? "尝试其他关键词" : "拖拽文件到上方区域或点击上传按钮"}
            </p>
          </div>
        ) : (
          <div class={`grid gap-3 ${
            gridSize.value === "small"
              ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
              : gridSize.value === "large"
                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
          }`}>
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
                class={`animate-fade-in-up clay-icon-card group relative p-3 stagger-${(idx % 8) + 1} ${selectedIds.ids.has(icon.id) ? "ring-2 ring-rose-400 bg-rose-50/50" : ""}`}
              >
                {/* Selection checkbox */}
                <button
                  class={`absolute top-2.5 left-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-all ${selectedIds.ids.has(icon.id) ? "border-rose-500 bg-rose-500" : "border-rose-200 bg-white/80 hover:border-rose-400"}`}
                  onClick$={() => toggleSelect(icon.id)}
                >
                  {selectedIds.ids.has(icon.id) && (
                    <svg class="h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>

                {/* Preview */}
                <button
                  class="mx-auto mt-4 flex aspect-square w-full max-w-[64px] items-center justify-center transition-transform duration-300 hover:scale-110"
                  onClick$={() => {
                    previewIcon.id = icon.id;
                    previewIcon.name = icon.name;
                    previewIcon.content = icon.content;
                    previewIcon.unicode = icon.unicode;
                    previewIcon.view_box = icon.view_box;
                    previewIcon.tags = icon.tags;
                    previewIcon.project_id = icon.project_id;
                    previewIcon.svg_path = icon.svg_path;
                    showIconDetail.value = true;
                  }}
                >
                  {icon.content ? (
                    <SvgPreview content={icon.content} class="h-full w-full" />
                  ) : (
                    <span class="text-xs text-rose-300">无预览</span>
                  )}
                </button>

                {/* Name */}
                <button
                  class="mt-2 w-full truncate text-center text-xs font-semibold text-rose-800 transition-colors hover:text-rose-500"
                  title={`点击复制类名: ${project.prefix}${icon.name}`}
                  onClick$={async (ev: any) => {
                    ev.stopPropagation();
                    await navigator.clipboard.writeText(`${project.prefix}${icon.name}`);
                    showToast(`已复制 ${project.prefix}${icon.name}`, "success");
                  }}
                >
                  <HighlightText text={icon.name} query={searchQuery.value} />
                </button>

                {/* Unicode */}
                {icon.unicode && (
                  <button
                    class="mt-0.5 font-mono text-[10px] text-rose-400/60 transition-colors hover:text-rose-500"
                    onClick$={async () => {
                      await navigator.clipboard.writeText(icon.unicode || "");
                      showToast(`已复制 ${icon.unicode}`, "success");
                    }}
                  >
                    {icon.unicode}
                  </button>
                )}

                {/* Actions */}
                <div class="mt-2 flex justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                    title="编辑"
                    onClick$={() => {
                      selectedIconForEdit.id = icon.id;
                      selectedIconForEdit.name = icon.name;
                      selectedIconForEdit.unicode = icon.unicode;
                      selectedIconForEdit.view_box = icon.view_box;
                      selectedIconForEdit.content = icon.content;
                      selectedIconForEdit.tags = icon.tags;
                      showSvgEditor.value = true;
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                    title="下载 SVG"
                    onClick$={() => {
                      const blob = new Blob([icon.content || ""], { type: "image/svg+xml" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${icon.name}.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast(`已下载 ${icon.name}.svg`, "success");
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  </button>
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                    title="删除"
                    onClick$={() => handleDelete(icon.id, icon.name)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Settings Modal ────────────────────────────────────── */}
      {showSettings.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-lg">
            <div class="border-b border-rose-100 px-6 py-4">
              <h3 class="font-['Nunito'] text-lg font-bold text-rose-950">项目设置</h3>
            </div>
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
              <div class="space-y-4 px-6 py-5">
                <div class="form-control">
                  <label class="label"><span class="label-text text-sm font-semibold text-rose-800">项目名称</span></label>
                  <input name="name" type="text" class="input-clay w-full px-4 py-2.5 text-sm" value={project.name} required />
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text text-sm font-semibold text-rose-800">描述</span></label>
                  <input name="description" type="text" class="input-clay w-full px-4 py-2.5 text-sm" value={project.description || ""} />
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text text-sm font-semibold text-rose-800">Font Family</span></label>
                  <input name="font_family" type="text" class="input-clay w-full px-4 py-2.5 text-sm" value={project.font_family} />
                </div>
                <div class="form-control">
                  <label class="label"><span class="label-text text-sm font-semibold text-rose-800">Class 前缀</span></label>
                  <input name="prefix" type="text" class="input-clay w-full px-4 py-2.5 text-sm" value={project.prefix} />
                  <label class="label"><span class="label-text-alt font-mono text-rose-400/60">示例: <span class="text-rose-500">{project.prefix}</span>example</span></label>
                </div>
              </div>
              <div class="flex justify-end gap-3 border-t border-rose-100 px-6 py-4">
                <button type="button" class="rounded-2xl px-5 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50" onClick$={() => (showSettings.value = false)}>取消</button>
                <button type="submit" class="clay-button rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white">保存</button>
              </div>
            </form>
          </div>
          <div class="modal-backdrop" onClick$={() => (showSettings.value = false)} />
        </div>
      )}

      {/* ── Preview Icon Modal ────────────────────────────────── */}
      {showPreview.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-sm text-center">
            <div class="p-6">
              <h3 class="font-['Nunito'] text-lg font-bold text-rose-950">{previewIcon.name}</h3>
              <div class="icon-preview-canvas mx-auto mt-4 flex h-32 w-32 items-center justify-center">
                {previewIcon.content && <SvgPreview content={previewIcon.content} class="h-full w-full" color={previewColor.value} />}
              </div>
              <div class="mt-4 flex items-center justify-center gap-2">
                {["#E11D48", "#2563EB", "#22C55E", "#F59E0B", "#A855F7", "#EC4899", "#333333"].map((c) => (
                  <button key={c} type="button" class={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${previewColor.value === c ? "border-rose-400 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick$={() => (previewColor.value = c)} />
                ))}
                <input type="color" class="h-7 w-7 cursor-pointer overflow-hidden rounded-full border-0 p-0" value={previewColor.value} onInput$={(ev: any) => (previewColor.value = ev.target.value)} />
              </div>
              {previewIcon.unicode && <p class="mt-3 font-mono text-sm text-rose-400/60">{previewIcon.unicode}</p>}
              <div class="mt-5 flex justify-center">
                <button class="rounded-2xl bg-rose-50 px-6 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-100" onClick$={() => (showPreview.value = false)}>关闭</button>
              </div>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => (showPreview.value = false)} />
        </div>
      )}

      {/* ── Edit Icon Modal ───────────────────────────────────── */}
      {showEdit.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-lg">
            <div class="border-b border-rose-100 px-6 py-4">
              <h3 class="font-['Nunito'] text-lg font-bold text-rose-950">编辑图标</h3>
            </div>
            <div class="p-6">
              <div class="flex gap-4">
                <div class="flex flex-shrink-0 flex-col items-center gap-2">
                  <div class="icon-preview-canvas flex h-24 w-24 items-center justify-center">
                    {editingIcon.content && <SvgPreview content={editingIcon.content} class="h-full w-full" color={previewColor.value} />}
                  </div>
                  <div class="flex items-center gap-1">
                    {["#E11D48", "#2563EB", "#22C55E", "#F59E0B", "#A855F7", "#EC4899", "#333333"].map((c) => (
                      <button key={c} type="button" class={`h-4 w-4 rounded-full border-2 transition-transform hover:scale-110 ${previewColor.value === c ? "border-rose-400 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick$={() => (previewColor.value = c)} />
                    ))}
                    <input type="color" class="h-4 w-4 cursor-pointer overflow-hidden rounded-full border-0 p-0" value={previewColor.value} onInput$={(ev: any) => (previewColor.value = ev.target.value)} />
                  </div>
                </div>
                <form
                  class="flex-1"
                  preventdefault:submit
                  onSubmit$={async (ev: any) => {
                    const fd = new FormData(ev.target);
                    const iconId = editingIcon.id;
                    const newContent = fd.get("content") as string;
                    const projectId = parseInt(loc.params.id, 10);
                    if (isLocal) {
                      updateLocalIcon(projectId, iconId!, {
                        name: fd.get("name") as string,
                        unicode: (fd.get("unicode") as string) || undefined,
                        view_box: (fd.get("view_box") as string) || undefined,
                        content: newContent || undefined,
                      });
                    } else {
                      await updateIcon.submit({
                        id: String(iconId),
                        name: fd.get("name"),
                        unicode: fd.get("unicode") || null,
                        view_box: fd.get("view_box") || "0 0 1024 1024",
                        content: newContent || null,
                      });
                    }
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
                    <label class="label"><span class="label-text text-sm font-semibold text-rose-800">图标名称</span></label>
                    <input name="name" type="text" class="input-clay w-full px-4 py-2.5 text-sm" value={editingIcon.name} required />
                  </div>
                  <div class="form-control mb-3">
                    <label class="label"><span class="label-text text-sm font-semibold text-rose-800">Unicode</span></label>
                    <div class="flex gap-2">
                      <input name="unicode" type="text" class="input-clay flex-1 px-4 py-2.5 text-sm" value={editingIcon.unicode || ""} placeholder="例如: &#xe600;" />
                      <button type="button" class="rounded-2xl bg-rose-50 px-4 text-sm font-semibold text-rose-600 transition-all hover:bg-rose-100" onClick$={autoUnicode}>自动生成</button>
                    </div>
                  </div>
                  <div class="form-control mb-3">
                    <label class="label"><span class="label-text text-sm font-semibold text-rose-800">ViewBox</span></label>
                    <input name="view_box" type="text" class="input-clay w-full px-4 py-2.5 text-sm" value={editingIcon.view_box || "0 0 1024 1024"} />
                  </div>
                  <div class="form-control mb-4">
                    <label class="label cursor-pointer" onClick$={() => (showSVGSource.value = !showSVGSource.value)}>
                      <span class="label-text text-sm font-semibold text-rose-800">SVG 源码</span>
                      <span class="label-text-alt text-rose-500">{showSVGSource.value ? "收起 ↑" : "展开 ↓"}</span>
                    </label>
                    {showSVGSource.value && (
                      <textarea name="content" class="input-clay h-32 w-full px-4 py-2.5 font-mono text-xs" value={editingIcon.content || ""} placeholder="<svg viewBox='0 0 1024 1024'>..." />
                    )}
                  </div>
                  <div class="flex justify-end gap-3">
                    <button type="button" class="rounded-2xl px-5 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50" onClick$={() => { showEdit.value = false; showSVGSource.value = false; }}>取消</button>
                    <button type="submit" class="clay-button rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white">保存</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => (showEdit.value = false)} />
        </div>
      )}

      {/* ── Code Generation Modal ─────────────────────────────── */}
      {showCode.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-3xl">
            <div class="border-b border-rose-100 px-6 py-4">
              <h3 class="font-['Nunito'] text-lg font-bold text-rose-950">生成代码</h3>
            </div>
            <div class="p-6">
              <div class="mb-4 flex gap-2">
                {(["fontclass", "symbol", "unicode"] as const).map((mode) => (
                  <button
                    key={mode}
                    class={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${codeMode.value === mode ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "bg-rose-50 text-rose-600 hover:bg-rose-100"}`}
                    onClick$={() => (codeMode.value = mode)}
                  >
                    {mode === "fontclass" ? "Font Class" : mode === "symbol" ? "Symbol" : "Unicode"}
                  </button>
                ))}
              </div>

              {codeMode.value === "fontclass" && selectedIds.ids.size > 0 && (
                <div class="mb-4 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 p-4">
                  <p class="mb-2 text-xs font-semibold text-rose-400/70">字体预览</p>
                  {fontPreviewCSS.value && <style>{fontPreviewCSS.value}</style>}
                  <div class="flex flex-wrap gap-3">
                    {icons.list.filter((i) => selectedIds.ids.has(i.id)).slice(0, 8).map((icon) => (
                      <div key={icon.id} class="flex flex-col items-center gap-1">
                        <i class={`${project.prefix} ${project.prefix}${icon.name}`} style="font-size: 24px;" />
                        <span class="text-[10px] text-rose-400/60">{icon.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {codeMode.value === "symbol" && selectedIds.ids.size > 0 && (
                <div class="mb-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                  <p class="mb-2 text-xs font-semibold text-blue-400/70">Symbol 引用示例</p>
                  <div class="flex flex-wrap gap-3">
                    {icons.list.filter((i) => selectedIds.ids.has(i.id)).slice(0, 8).map((icon) => (
                      <div key={icon.id} class="flex flex-col items-center gap-1">
                        <svg class="h-6 w-6 text-blue-500" aria-hidden="true"><use href={`#${project.prefix}${icon.name}`} /></svg>
                        <span class="text-[10px] text-blue-400/60">{icon.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {codeMode.value === "unicode" && selectedIds.ids.size > 0 && (
                <div class="mb-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
                  <p class="mb-2 text-xs font-semibold text-emerald-400/70">Unicode 预览</p>
                  <div class="flex flex-wrap gap-3">
                    {icons.list.filter((i) => selectedIds.ids.has(i.id)).slice(0, 8).map((icon, idx) => {
                      const code = icon.unicode ? parseInt(icon.unicode.replace(/^&#x?|^\\|^U\+/i, "").replace(/;$/, ""), 16) : 0xe000 + idx;
                      return (
                        <div key={icon.id} class="flex flex-col items-center gap-1">
                          <span class="text-2xl text-emerald-600">{String.fromCharCode(code)}</span>
                          <span class="text-[10px] text-emerald-400/60">{icon.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div class="group relative rounded-2xl bg-rose-950 p-4">
                <pre class="max-h-80 overflow-auto text-sm whitespace-pre-wrap text-rose-100"><code>{generatedCode.value}</code></pre>
                <button class={`absolute top-3 right-3 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${copied.value ? "bg-emerald-500 text-white" : "bg-white/10 text-rose-200 opacity-0 group-hover:opacity-100 hover:bg-white/20"}`} onClick$={copyToClipboard}>
                  {copied.value ? "已复制!" : "复制"}
                </button>
              </div>
              <div class="mt-4 flex justify-end gap-3">
                <button class="clay-button rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white" onClick$={() => {
                  const code = generatedCode.value;
                  if (!code) return;
                  const mode = codeMode.value;
                  const mime = mode === "symbol" ? "image/svg+xml" : mode === "fontclass" ? "text/css" : "text/plain";
                  const ext = mode === "symbol" ? "svg" : mode === "fontclass" ? "css" : "txt";
                  const blob = new Blob([code], { type: mime });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${project.font_family}.${ext}`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast(`已下载 ${project.font_family}.${ext}`, "success");
                }}>下载代码</button>
                <button class="rounded-2xl px-5 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50" onClick$={() => (showCode.value = false)}>关闭</button>
              </div>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => (showCode.value = false)} />
        </div>
      )}

      {/* ── Batch Rename Modal ────────────────────────────────── */}
      {showBatchRename.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-lg">
            <div class="border-b border-rose-100 px-6 py-4">
              <h3 class="font-['Nunito'] text-lg font-bold text-rose-950">批量重命名 ({selectedIds.ids.size} 个图标)</h3>
            </div>
            <form
              preventdefault:submit
              onSubmit$={async () => {
                const ids = Array.from(selectedIds.ids).join(",");
                await batchRenameIcons.submit({ ids, prefix: renameForm.prefix, suffix: renameForm.suffix, find: renameForm.find, replace: renameForm.replace });
                for (let i = 0; i < icons.list.length; i++) {
                  const icon = icons.list[i];
                  if (!selectedIds.ids.has(icon.id)) continue;
                  let newName = icon.name;
                  if (renameForm.find) newName = newName.split(renameForm.find).join(renameForm.replace);
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
              <div class="space-y-3 px-6 py-5">
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-control">
                    <label class="label"><span class="label-text text-sm font-semibold text-rose-800">前缀</span></label>
                    <input type="text" class="input-clay w-full px-4 py-2.5 text-sm" placeholder="例如: icon-" value={renameForm.prefix} onInput$={(ev: any) => (renameForm.prefix = ev.target.value)} />
                  </div>
                  <div class="form-control">
                    <label class="label"><span class="label-text text-sm font-semibold text-rose-800">后缀</span></label>
                    <input type="text" class="input-clay w-full px-4 py-2.5 text-sm" placeholder="例如: -new" value={renameForm.suffix} onInput$={(ev: any) => (renameForm.suffix = ev.target.value)} />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-control">
                    <label class="label"><span class="label-text text-sm font-semibold text-rose-800">查找</span></label>
                    <input type="text" class="input-clay w-full px-4 py-2.5 text-sm" placeholder="要替换的文本" value={renameForm.find} onInput$={(ev: any) => (renameForm.find = ev.target.value)} />
                  </div>
                  <div class="form-control">
                    <label class="label"><span class="label-text text-sm font-semibold text-rose-800">替换为</span></label>
                    <input type="text" class="input-clay w-full px-4 py-2.5 text-sm" placeholder="新文本" value={renameForm.replace} onInput$={(ev: any) => (renameForm.replace = ev.target.value)} />
                  </div>
                </div>
                {renamePreview.value.items.length > 0 && (
                  <div class="rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 p-3">
                    <p class="mb-2 text-xs font-semibold text-rose-400/70">预览 {renamePreview.value.total > renamePreview.value.items.length && <span class="text-rose-300">（前 {renamePreview.value.items.length} 个，共 {renamePreview.value.total} 个）</span>}</p>
                    <div class="space-y-1 text-sm">
                      {renamePreview.value.items.map((p, idx) => (
                        <div key={idx} class="flex items-center gap-2">
                          <span class="flex-1 truncate text-rose-300 line-through">{p.oldName}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="flex-shrink-0 text-rose-300"><path d="m9 18 6-6-6-6"/></svg>
                          <span class="flex-1 truncate font-semibold text-rose-600">{p.newName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div class="flex justify-end gap-3 border-t border-rose-100 px-6 py-4">
                <button type="button" class="rounded-2xl px-5 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50" onClick$={() => { renameForm.prefix = ""; renameForm.suffix = ""; renameForm.find = ""; renameForm.replace = ""; showBatchRename.value = false; }}>取消</button>
                <button type="submit" class="clay-button rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white">应用</button>
              </div>
            </form>
          </div>
          <div class="modal-backdrop" onClick$={() => (showBatchRename.value = false)} />
        </div>
      )}

      {/* ── Confirm Delete Icon Modal ─────────────────────────── */}
      {confirmDeleteIcon.show && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-sm text-center">
            <div class="p-6">
              <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E11D48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <h3 class="font-['Nunito'] text-lg font-bold text-rose-950">确认删除</h3>
              <p class="mt-2 text-sm text-rose-700/60">确定要删除图标 "{confirmDeleteIcon.iconName}" 吗？此操作不可恢复。</p>
              <div class="mt-5 flex justify-center gap-3">
                <button class="rounded-2xl px-5 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50" onClick$={() => { confirmDeleteIcon.show = false; confirmDeleteIcon.iconId = 0; }}>取消</button>
                <button class="clay-button rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white" onClick$={doDeleteIcon}>删除</button>
              </div>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => { confirmDeleteIcon.show = false; confirmDeleteIcon.iconId = 0; }} />
        </div>
      )}

      {/* ── Confirm Batch Delete Modal ────────────────────────── */}
      {confirmBatchDelete.show && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-sm text-center">
            <div class="p-6">
              <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E11D48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <h3 class="font-['Nunito'] text-lg font-bold text-rose-950">确认批量删除</h3>
              <p class="mt-2 text-sm text-rose-700/60">确定要删除选中的 {confirmBatchDelete.count} 个图标吗？此操作不可恢复。</p>
              <div class="mt-5 flex justify-center gap-3">
                <button class="rounded-2xl px-5 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50" onClick$={() => { confirmBatchDelete.show = false; confirmBatchDelete.count = 0; }}>取消</button>
                <button class="clay-button rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white" onClick$={doBatchDelete}>删除</button>
              </div>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => { confirmBatchDelete.show = false; confirmBatchDelete.count = 0; }} />
        </div>
      )}

      {/* ── Keyboard Shortcuts Help ───────────────────────────── */}
      {showShortcuts.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-xs">
            <div class="p-5">
              <h3 class="font-['Nunito'] mb-4 text-base font-bold text-rose-950">键盘快捷键</h3>
              <div class="space-y-2 text-sm">
                {[
                  ["搜索聚焦", "/"],
                  ["关闭弹窗", "Esc"],
                  ["快捷键帮助", "?"],
                  ["全选", "Ctrl+A"],
                  ["删除选中", "Delete"],
                ].map(([label, key]) => (
                  <div class="flex items-center justify-between py-1" key={label}>
                    <span class="text-rose-700/60">{label}</span>
                    <kbd class="rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">{key}</kbd>
                  </div>
                ))}
              </div>
              <div class="mt-4 flex justify-end">
                <button class="rounded-2xl px-4 py-2 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50" onClick$={() => (showShortcuts.value = false)}>关闭</button>
              </div>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => (showShortcuts.value = false)} />
        </div>
      )}

      {/* ── SVG Editor Modal ──────────────────────────────────── */}
      {showSvgEditor.value && selectedIconForEdit.id && (
        <SvgEditor
          icon={selectedIconForEdit}
          onSave$={async (icon) => {
            const projectId = parseInt(loc.params.id, 10);
            if (isLocal) {
              updateLocalIcon(projectId, icon.id!, {
                name: icon.name || undefined,
                unicode: icon.unicode || undefined,
                view_box: icon.view_box || undefined,
                content: icon.content || undefined,
                tags: icon.tags || undefined,
              });
            } else {
              await updateIcon.submit({
                id: String(icon.id),
                name: icon.name || "",
                unicode: icon.unicode || null,
                view_box: icon.view_box || "0 0 1024 1024",
                content: icon.content || null,
                tags: icon.tags || null,
              });
            }
            const idx = icons.list.findIndex((i) => i.id === icon.id);
            if (idx >= 0) {
              icons.list[idx] = { ...icons.list[idx], ...icon } as Icon;
            }
            showSvgEditor.value = false;
            showToast("图标已更新", "success");
          }}
          onClose$={() => (showSvgEditor.value = false)}
        />
      )}

      {/* ── Icon Detail Panel ─────────────────────────────────── */}
      {showIconDetail.value && previewIcon.id && (
        <IconDetailPanel
          icon={previewIcon}
          prefix={project.prefix}
          fontFamily={project.font_family}
          onEdit$={(icon) => {
            selectedIconForEdit.id = icon.id;
            selectedIconForEdit.name = icon.name;
            selectedIconForEdit.unicode = icon.unicode;
            selectedIconForEdit.view_box = icon.view_box;
            selectedIconForEdit.content = icon.content;
            selectedIconForEdit.tags = icon.tags;
            showIconDetail.value = false;
            showSvgEditor.value = true;
          }}
          onDelete$={(id) => {
            const icon = icons.list.find((i) => i.id === id);
            if (icon) handleDelete(id, icon.name);
            showIconDetail.value = false;
          }}
          onClose$={() => (showIconDetail.value = false)}
        />
      )}

      {/* ── Batch Tag Management Modal ────────────────────────── */}
      {showBatchTag.value && (
        <div class="modal modal-open">
          <div class="clay-card animate-modal mx-4 max-w-lg">
            <div class="border-b border-rose-100 px-6 py-4">
              <h3 class="font-['Nunito'] text-lg font-bold text-rose-950">批量标签管理 ({selectedIds.ids.size} 个图标)</h3>
            </div>
            <div class="p-6">
              <div class="mb-4 flex gap-2">
                {(["add", "remove", "set"] as const).map((action) => (
                  <button
                    key={action}
                    class={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${batchTagForm.action === action ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "bg-rose-50 text-rose-600 hover:bg-rose-100"}`}
                    onClick$={() => (batchTagForm.action = action)}
                  >
                    {action === "add" ? "添加" : action === "remove" ? "移除" : "设置"}
                  </button>
                ))}
              </div>
              <div class="form-control mb-4">
                <label class="label"><span class="label-text text-sm font-semibold text-rose-800">
                  {batchTagForm.action === "add" ? "添加标签（逗号分隔）" : batchTagForm.action === "remove" ? "移除标签（逗号分隔）" : "设置标签（逗号分隔）"}
                </span></label>
                <input type="text" class="input-clay w-full px-4 py-2.5 text-sm" placeholder="例如: outline, filled, basic" value={batchTagForm.tags} onInput$={(e: any) => (batchTagForm.tags = e.target.value)} />
              </div>
              {allTags.value.length > 0 && (
                <div class="mb-4">
                  <label class="label"><span class="label-text text-xs font-semibold text-rose-400/70">已有标签</span></label>
                  <div class="flex flex-wrap gap-1.5">
                    {allTags.value.map((tag) => (
                      <button key={tag} class="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-100" onClick$={() => {
                        const current = batchTagForm.tags.split(",").filter(Boolean);
                        if (!current.includes(tag)) {
                          batchTagForm.tags = [...current, tag].join(",");
                        }
                      }}>{tag}</button>
                    ))}
                  </div>
                </div>
              )}
              <div class="flex justify-end gap-3">
                <button class="rounded-2xl px-5 py-2.5 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50" onClick$={() => (showBatchTag.value = false)}>取消</button>
                <button class="clay-button rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-bold text-white" onClick$={async () => {
                  const ids = Array.from(selectedIds.ids).join(",");
                  await batchUpdateTags.submit({ ids, action: batchTagForm.action, tags: batchTagForm.tags });
                  const newTags = batchTagForm.tags.split(",").filter(Boolean);
                  for (const id of Array.from(selectedIds.ids)) {
                    const idx = icons.list.findIndex((i) => i.id === id);
                    if (idx < 0) continue;
                    const existing = parseTags(icons.list[idx].tags);
                    let finalTags: string[];
                    if (batchTagForm.action === "add") {
                      finalTags = [...new Set([...existing, ...newTags])];
                    } else if (batchTagForm.action === "remove") {
                      finalTags = existing.filter((t) => !newTags.includes(t));
                    } else {
                      finalTags = newTags;
                    }
                    icons.list[idx] = { ...icons.list[idx], tags: finalTags.join(",") } as Icon;
                  }
                  batchTagForm.tags = "";
                  showBatchTag.value = false;
                  showToast("批量标签更新完成", "success");
                }}>应用</button>
              </div>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => (showBatchTag.value = false)} />
        </div>
      )}
    </div>
  );
});
