import { component$, useSignal, $, useStore, useTask$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, useLocation, useNavigate } from "@builder.io/qwik-city";
import type { Project, Icon } from "~/lib/types";
import { generateTTFFont, generateCSS, generateSymbolSVG, generateDemoHTML } from "~/lib/font-gen";

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

export default component$(() => {
  const data = useProject();
  const loc = useLocation();
  const nav = useNavigate();
  const deleteIcon = useDeleteIcon();
  const updateProject = useUpdateProject();
  const updateIcon = useUpdateIcon();

  const project = useStore({ ...data.value.project });
  const icons = useStore({ list: [...data.value.icons] });
  const selectedIds = useStore({ ids: new Set<number>() });
  const uploadLoading = useSignal(false);
  const showSettings = useSignal(false);
  const showCode = useSignal(false);
  const showEdit = useSignal(false);
  const editingIcon = useStore<Partial<Icon>>({});
  const codeMode = useSignal<"symbol" | "fontclass" | "unicode">("fontclass");
  const generatedCode = useSignal("");

  const handleFileUpload = $(async (files: FileList | null) => {
    if (!files) return;
    uploadLoading.value = true;
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
  });

  const handleDelete = $(async (iconId: number) => {
    if (!confirm("确定要删除这个图标吗？")) return;
    await deleteIcon.submit({ id: String(iconId) });
    icons.list = icons.list.filter((i) => i.id !== iconId);
    const next = new Set(selectedIds.ids);
    next.delete(iconId);
    selectedIds.ids = next;
  });

  const toggleSelect = $((id: number) => {
    const next = new Set(selectedIds.ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.ids = next;
  });

  const selectAll = $(() => {
    if (selectedIds.ids.size === icons.list.length) {
      selectedIds.ids = new Set();
    } else {
      selectedIds.ids = new Set(icons.list.map((i) => i.id));
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
      return `@font-face {\n  font-family: "${project.font_family}";\n  src: url('${project.font_family}.woff2') format('woff2');\n}\n\n.${project.prefix} {\n  font-family: "${project.font_family}" !important;\n  font-style: normal;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n\n${classes}`;
    }

    if (codeMode.value === "symbol") {
      const symbols = selected.map((icon) => {
        const svgContent = icon.content || "";
        const viewBox = icon.view_box || "0 0 1024 1024";
        return `<symbol id="${project.prefix}${icon.name}" viewBox="${viewBox}">${svgContent.replace(/<svg[^>]*>|<\/svg>/gi, "")}</symbol>`;
      }).join("\n");
      return `<svg style="position: absolute; width: 0; height: 0; overflow: hidden;" aria-hidden="true">\n  <defs>\n    ${symbols}\n  </defs>\n</svg>`;
    }

    // unicode mode
    return selected.map((icon) => {
      const unicode = icon.unicode || `&#x${(0xe000 + icon.id).toString(16)};`;
      return `<i class="${project.prefix}" style="font-family: '${project.font_family}'">${unicode}</i>`;
    }).join("\n");
  });

  const handleDownloadFont = $(async () => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    if (selected.length === 0) {
      alert("请先选择图标");
      return;
    }
    const ttf = await generateTTFFont(project.font_family, selected, project.prefix);
    if (!ttf) {
      alert("字体生成失败");
      return;
    }
    const blob = new Blob([ttf], { type: "font/ttf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.font_family}.ttf`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const handleDownloadPackage = $(async () => {
    const selected = icons.list.filter((i) => selectedIds.ids.has(i.id));
    if (selected.length === 0) {
      alert("请先选择图标");
      return;
    }
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // CSS
    zip.file(`${project.font_family}.css`, generateCSS(project.font_family, project.prefix, selected));

    // Symbol SVG
    zip.file(`${project.font_family}-symbol.svg`, generateSymbolSVG(selected, project.prefix));

    // Demo HTML
    zip.file("demo.html", generateDemoHTML(project.font_family, project.prefix, selected));

    // TTF Font
    const ttf = await generateTTFFont(project.font_family, selected, project.prefix);
    if (ttf) {
      zip.file(`${project.font_family}.ttf`, new Uint8Array(ttf));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.font_family}-iconfont.zip`;
    a.click();
    URL.revokeObjectURL(url);
  });

  useTask$(async ({ track }) => {
    track(() => codeMode.value);
    track(() => selectedIds.ids.size);
    track(() => icons.list.length);
    generatedCode.value = await buildCode();
  });

  return (
    <div class="min-h-screen bg-base-200">
      {/* Header */}
      <div class="navbar bg-base-100 shadow-sm">
        <div class="flex-none">
          <button class="btn btn-ghost btn-sm" onClick$={() => nav("/")}>
            ← 返回
          </button>
        </div>
        <div class="flex-1 px-4">
          <h1 class="text-xl font-bold">{project.name}</h1>
        </div>
        <div class="flex-none gap-2">
          <button class="btn btn-outline btn-sm" onClick$={() => showSettings.value = true}>
            项目设置
          </button>
          <button class="btn btn-outline btn-sm" onClick$={handleDownloadFont}>
            下载字体
          </button>
          <button class="btn btn-primary btn-sm" onClick$={async () => { showCode.value = true; generatedCode.value = await buildCode(); }}>
            生成代码
          </button>
          <button class="btn btn-secondary btn-sm" onClick$={handleDownloadPackage}>
            打包下载
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div class="container mx-auto px-4 py-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <label class="label cursor-pointer gap-2">
              <input
                type="checkbox"
                class="checkbox"
                checked={selectedIds.ids.size === icons.list.length && icons.list.length > 0}
                onChange$={selectAll}
              />
              <span class="label-text">全选 ({selectedIds.ids.size}/{icons.list.length})</span>
            </label>
            {selectedIds.ids.size > 0 && (
              <button class="btn btn-error btn-sm" onClick$={async () => {
                if (!confirm(`确定删除选中的 ${selectedIds.ids.size} 个图标？`)) return;
                for (const id of Array.from(selectedIds.ids)) {
                  await deleteIcon.submit({ id: String(id) });
                }
                icons.list = icons.list.filter((i) => !selectedIds.ids.has(i.id));
                selectedIds.ids = new Set();
              }}>
                删除选中
              </button>
            )}
          </div>

          <div class="flex gap-2">
            <div class="relative">
              <input
                type="file"
                accept=".svg"
                multiple
                class="absolute inset-0 opacity-0 cursor-pointer"
                onChange$={(ev: any) => handleFileUpload(ev.target.files)}
              />
              <button class="btn btn-primary btn-sm">
                {uploadLoading.value ? "上传中..." : "+ 上传图标"}
              </button>
            </div>
          </div>
        </div>

        {/* Drop zone hint */}
        <div class="mt-2 p-4 border-2 border-dashed border-base-300 rounded-lg text-center text-sm text-gray-500">
          拖拽 SVG 文件到此处上传，或点击"上传图标"按钮
        </div>
      </div>

      {/* Icons Grid */}
      <div class="container mx-auto px-4 pb-8">
        {icons.list.length === 0 ? (
          <div class="card bg-base-100 shadow">
            <div class="card-body items-center text-center">
              <p class="text-gray-500">暂无图标，请上传 SVG 文件</p>
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {icons.list.map((icon) => (
              <div
                key={icon.id}
                class={`card bg-base-100 shadow hover:shadow-md cursor-pointer transition-all ${
                  selectedIds.ids.has(icon.id) ? "ring-2 ring-primary" : ""
                }`}
                onClick$={() => toggleSelect(icon.id)}
              >
                <div class="card-body p-3 items-center text-center">
                  <div class="w-12 h-12 flex items-center justify-center">
                    {icon.content ? (
                      <div dangerouslySetInnerHTML={icon.content} />
                    ) : (
                      <span class="text-xs text-gray-400">无预览</span>
                    )}
                  </div>
                  <p class="text-xs truncate w-full" title={icon.name}>
                    {icon.name}
                  </p>
                  {icon.unicode && (
                    <span class="text-[10px] text-gray-400">{icon.unicode}</span>
                  )}
                  <div class="flex gap-1 mt-1">
                    <button
                      class="btn btn-ghost btn-xs"
                      onClick$={(ev: any) => {
                        ev.stopPropagation();
                        editingIcon.id = icon.id;
                        editingIcon.name = icon.name;
                        editingIcon.unicode = icon.unicode;
                        editingIcon.view_box = icon.view_box;
                        showEdit.value = true;
                      }}
                    >
                      编辑
                    </button>
                    <button
                      class="btn btn-ghost btn-xs text-error"
                      onClick$={(ev: any) => {
                        ev.stopPropagation();
                        handleDelete(icon.id);
                      }}
                    >
                      删除
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
            <form
              onSubmit$={async (ev: any) => {
                ev.preventDefault();
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
              }}
            >
              <div class="form-control mb-3">
                <label class="label"><span class="label-text">项目名称</span></label>
                <input name="name" type="text" class="input input-bordered" value={project.name} required />
              </div>
              <div class="form-control mb-3">
                <label class="label"><span class="label-text">描述</span></label>
                <input name="description" type="text" class="input input-bordered" value={project.description || ""} />
              </div>
              <div class="form-control mb-3">
                <label class="label"><span class="label-text">Font Family</span></label>
                <input name="font_family" type="text" class="input input-bordered" value={project.font_family} />
              </div>
              <div class="form-control mb-4">
                <label class="label"><span class="label-text">Class 前缀</span></label>
                <input name="prefix" type="text" class="input input-bordered" value={project.prefix} />
              </div>
              <div class="modal-action">
                <button type="button" class="btn" onClick$={() => showSettings.value = false}>取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
              </div>
            </form>
          </div>
          <div class="modal-backdrop" onClick$={() => showSettings.value = false} />
        </div>
      )}

      {/* Edit Icon Modal */}
      {showEdit.value && (
        <div class="modal modal-open">
          <div class="modal-box max-w-lg">
            <h3 class="font-bold text-lg mb-4">编辑图标</h3>
            <form
              onSubmit$={async (ev: any) => {
                ev.preventDefault();
                const fd = new FormData(ev.target);
                const iconId = editingIcon.id;
                await updateIcon.submit({
                  id: String(iconId),
                  name: fd.get("name"),
                  unicode: fd.get("unicode") || null,
                  view_box: fd.get("view_box") || "0 0 1024 1024",
                });
                const idx = icons.list.findIndex((i) => i.id === iconId);
                if (idx >= 0) {
                  icons.list[idx] = { ...icons.list[idx], name: fd.get("name") as string, unicode: fd.get("unicode") as string || null, view_box: fd.get("view_box") as string };
                }
                showEdit.value = false;
              }}
            >
              <div class="form-control mb-3">
                <label class="label"><span class="label-text">图标名称</span></label>
                <input name="name" type="text" class="input input-bordered" value={editingIcon.name} required />
              </div>
              <div class="form-control mb-3">
                <label class="label"><span class="label-text">Unicode</span></label>
                <input name="unicode" type="text" class="input input-bordered" value={editingIcon.unicode || ""} placeholder="例如: &#xe600;" />
              </div>
              <div class="form-control mb-4">
                <label class="label"><span class="label-text">ViewBox</span></label>
                <input name="view_box" type="text" class="input input-bordered" value={editingIcon.view_box || "0 0 1024 1024"} />
              </div>
              <div class="modal-action">
                <button type="button" class="btn" onClick$={() => showEdit.value = false}>取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
              </div>
            </form>
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
              <button
                class={`tab ${codeMode.value === "fontclass" ? "tab-active" : ""}`}
                onClick$={() => codeMode.value = "fontclass"}
              >
                Font Class
              </button>
              <button
                class={`tab ${codeMode.value === "symbol" ? "tab-active" : ""}`}
                onClick$={() => codeMode.value = "symbol"}
              >
                Symbol
              </button>
              <button
                class={`tab ${codeMode.value === "unicode" ? "tab-active" : ""}`}
                onClick$={() => codeMode.value = "unicode"}
              >
                Unicode
              </button>
            </div>
            <div class="bg-base-300 rounded-lg p-4">
              <pre class="text-sm overflow-auto max-h-80 whitespace-pre-wrap">
                <code>{generatedCode.value}</code>
              </pre>
            </div>
            <div class="modal-action">
              <button
                class="btn btn-primary"
                onClick$={() => {
                  const code = generatedCode.value;
                  if (!code) return;
                  const blob = new Blob([code], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `iconfont-${codeMode.value}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                下载代码
              </button>
              <button class="btn" onClick$={() => showCode.value = false}>关闭</button>
            </div>
          </div>
          <div class="modal-backdrop" onClick$={() => showCode.value = false} />
        </div>
      )}
    </div>
  );
});
