import {
  component$,
  useComputed$,
  useSignal,
  useStore,
  useTask$,
  $,
  type QRL,
} from "@builder.io/qwik";
import type { Icon } from "~/lib/types";
import {
  parseTags,
  formatTags,
  resolveSvgViewBox,
  extractSvgViewBox,
} from "~/lib/types";
import { SvgPreview } from "~/components/svg-preview/svg-preview";

interface SvgEditorProps {
  icon: Partial<Icon>;
  onSave$: QRL<(icon: Partial<Icon>) => void>;
  onClose$: QRL<() => void>;
}

interface TransformState {
  scaleX: number;
  scaleY: number;
  rotate: number;
  translateX: number;
  translateY: number;
}

// ---- helpers ---------------------------------------------------------------

/** Build a complete SVG string with the given viewBox and fill colour applied. */
function buildColoredSvg(raw: string, viewBox: string, color: string): string {
  if (!raw) return "";
  let svg = raw;

  // Ensure viewBox
  if (/viewBox=/i.test(svg)) {
    svg = svg.replace(/viewBox="[^"]*"/i, `viewBox="${viewBox}"`);
  } else {
    svg = svg.replace(/<svg/i, `<svg viewBox="${viewBox}"`);
  }

  // Apply fill colour — skip fill="none" and fill="url(#...)" (gradients/patterns)
  svg = svg.replace(/\bfill="(?!none"|(?:url\())[^ "]*"/gi, `fill="${color}"`);
  // Apply stroke colour — same exclusions
  svg = svg.replace(
    /\bstroke="(?!none"|(?:url\())[^ "]*"/gi,
    `stroke="${color}"`,
  );

  // If root <svg> still has no fill, add it
  if (!/\bfill="/i.test(svg)) {
    svg = svg.replace(/<svg/i, `<svg fill="${color}"`);
  }

  return svg;
}

// ---- component -------------------------------------------------------------

export const SvgEditor = component$((props: SvgEditorProps) => {
  const { icon, onSave$, onClose$ } = props;
  const initialViewBox = resolveSvgViewBox(icon.view_box, icon.content);

  // ---- state (signals) -----------------------------------------------------

  const name = useSignal(icon.name || "");
  const unicode = useSignal(icon.unicode || "");
  const viewBox = useSignal(initialViewBox);
  const svgContent = useSignal(icon.content || "");
  const tags = useSignal(parseTags(icon.tags ?? null).join(", "));
  const fillColor = useSignal("#000000");

  const previewSize = useSignal(64);
  const showRawCode = useSignal(false);
  const showCloseConfirm = useSignal(false);
  const copiedSvg = useSignal(false);

  const transform = useStore<TransformState>({
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
    translateX: 0,
    translateY: 0,
  });

  const viewBoxParts = useStore({
    minX: 0,
    minY: 0,
    vbWidth: 1024,
    vbHeight: 1024,
  });

  // ---- derived: dirty state, validation ------------------------------------

  const isDirty = useComputed$(() => {
    const origTags = parseTags(icon.tags ?? null).join(", ");
    return (
      name.value !== (icon.name || "") ||
      unicode.value !== (icon.unicode || "") ||
      viewBox.value !== initialViewBox ||
      svgContent.value !== (icon.content || "") ||
      tags.value !== origTags
    );
  });

  const svgIsValid = useComputed$(() => {
    const c = svgContent.value.trim();
    return c === "" || /<svg[\s>]/i.test(c);
  });

  const nameIsValid = useComputed$(() => {
    const n = name.value.trim();
    return n === "" || /^[a-zA-Z0-9_-]+$/.test(n);
  });

  // ---- derived: reactive viewBox sync ---------------------------------------

  // Sync viewBoxParts from viewBox signal (handles direct text input)
  useTask$(({ track }) => {
    const vb = track(() => viewBox.value);
    const vp = vb.trim().split(/\s+|,/).map(Number);
    if (
      vp.length >= 4 &&
      !isNaN(vp[0]) &&
      !isNaN(vp[1]) &&
      !isNaN(vp[2]) &&
      !isNaN(vp[3])
    ) {
      viewBoxParts.minX = vp[0];
      viewBoxParts.minY = vp[1];
      viewBoxParts.vbWidth = vp[2];
      viewBoxParts.vbHeight = vp[3];
    }
  });

  // ---- derived (useComputed$): reactive preview data URL -------------------
  // This callback re-runs whenever any signal it reads changes, producing
  // a new data:image/svg+xml URL that Qwik patches onto the <img src> attribute.

  const previewSvg = useComputed$(() => {
    const raw = svgContent.value;
    const vb = resolveSvgViewBox(viewBox.value, raw);
    const color = fillColor.value;

    if (!raw) return "";

    let svg = buildColoredSvg(raw, vb, color);
    const tx = transform;
    const hasTx =
      tx.scaleX !== 1 ||
      tx.scaleY !== 1 ||
      tx.rotate !== 0 ||
      tx.translateX !== 0 ||
      tx.translateY !== 0;

    if (hasTx) {
      const txf: string[] = [];
      if (tx.scaleX !== 1 || tx.scaleY !== 1)
        txf.push(`scale(${tx.scaleX}, ${tx.scaleY})`);
      if (tx.rotate !== 0) txf.push(`rotate(${tx.rotate})`);
      if (tx.translateX !== 0 || tx.translateY !== 0)
        txf.push(`translate(${tx.translateX}, ${tx.translateY})`);
      const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      if (match) {
        svg = svg.replace(
          match[1],
          `<g transform="${txf.join(" ")}">${match[1]}</g>`,
        );
      }
    }

    return svg;
  });

  // ---- actions -------------------------------------------------------------

  const syncViewBox = $(() => {
    viewBox.value = `${viewBoxParts.minX} ${viewBoxParts.minY} ${viewBoxParts.vbWidth} ${viewBoxParts.vbHeight}`;
  });

  const detectViewBox = $(() => {
    const detectedViewBox = extractSvgViewBox(svgContent.value);
    if (detectedViewBox) {
      viewBox.value = detectedViewBox;
      const p = detectedViewBox.trim().split(/\s+|,/).map(Number);
      if (p.length >= 4) {
        viewBoxParts.minX = p[0];
        viewBoxParts.minY = p[1];
        viewBoxParts.vbWidth = p[2];
        viewBoxParts.vbHeight = p[3];
      }
    }
  });

  const getTransformedSvg = $(() => {
    let svg = svgContent.value;
    const resolvedViewBox = resolveSvgViewBox(viewBox.value, svgContent.value);
    if (!svg.includes("viewBox")) {
      svg = svg.replace(/<svg([^>]*)>/, `<svg$1 viewBox="${resolvedViewBox}">`);
    } else {
      svg = svg.replace(
        /viewBox=["'][^"']+["']/,
        `viewBox="${resolvedViewBox}"`,
      );
    }

    const tx = transform;
    const hasTx =
      tx.scaleX !== 1 ||
      tx.scaleY !== 1 ||
      tx.rotate !== 0 ||
      tx.translateX !== 0 ||
      tx.translateY !== 0;

    if (hasTx) {
      const txf: string[] = [];
      if (tx.scaleX !== 1 || tx.scaleY !== 1)
        txf.push(`scale(${tx.scaleX}, ${tx.scaleY})`);
      if (tx.rotate !== 0) txf.push(`rotate(${tx.rotate})`);
      if (tx.translateX !== 0 || tx.translateY !== 0)
        txf.push(`translate(${tx.translateX}, ${tx.translateY})`);
      const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
      if (m) {
        svg = svg.replace(m[1], `<g transform="${txf.join(" ")}">${m[1]}</g>`);
      }
    }
    return svg;
  });

  const handleSave = $(async () => {
    try {
      const out = await getTransformedSvg();
      const tagsStr = formatTags(
        tags.value
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      );
      const resolvedViewBox = resolveSvgViewBox(
        viewBox.value,
        svgContent.value,
      );
      await onSave$({
        ...icon,
        name: name.value,
        unicode: unicode.value || null,
        view_box: resolvedViewBox,
        content: out,
        tags: tagsStr || null,
      } as Partial<Icon>);
    } catch (err) {
      console.error("Failed to save icon:", err);
    }
  });

  const handleClose = $(() => {
    if (isDirty.value) {
      showCloseConfirm.value = true;
    } else {
      onClose$();
    }
  });

  const handleKeyDown = $((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      // eslint-disable-next-line qwik/no-async-prevent-default
      e.preventDefault();
      handleSave();
      return;
    }
    if (e.key === "Escape") handleClose();
  });

  // ---- render --------------------------------------------------------------

  const previewContent = previewSvg.value;
  const isEmpty = !svgContent.value;

  return (
    <div class="modal modal-open p-4" onKeyDown$={handleKeyDown} tabIndex={0}>
      <div class="modal-box animate-modal-box bg-base-100 flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden p-0 shadow-2xl">
        {/* Header */}
        <div class="border-base-200 bg-base-200/60 flex items-start justify-between gap-4 border-b px-6 py-5">
          <div class="space-y-1">
            <h3 class="flex items-center gap-2 text-lg font-semibold">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              编辑图标
              {isDirty.value && (
                <span
                  class="badge badge-warning badge-xs ml-1"
                  title="有未保存的修改"
                >
                  未保存
                </span>
              )}
            </h3>
            <p class="text-base-content/60 text-sm">
              预览、调整 ViewBox、编辑 SVG 与标签，保存后会立即同步到项目。
            </p>
          </div>
          <button
            class="btn btn-ghost btn-sm btn-square"
            onClick$={handleClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div class="grid gap-4 xl:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
            {/* Left: Preview */}
            <div class="flex min-w-0 flex-col gap-4">
              <div class="card bg-base-200 border-base-300 border shadow-sm">
                <div class="card-body p-5">
                  {/* Preview (300×300) + color panel side by side */}
                  <div class="flex flex-col gap-5 sm:flex-row sm:items-start">

                    {/* 300×300 fixed preview */}
                    <div
                      class="mx-auto shrink-0 overflow-hidden rounded-xl sm:mx-0"
                      style={{
                        width: "300px",
                        height: "300px",
                        backgroundColor: "rgb(255,255,255)",
                        backgroundImage:
                          "linear-gradient(45deg,rgb(243,244,246) 25%,transparent 25%)," +
                          "linear-gradient(-45deg,rgb(243,244,246) 25%,transparent 25%)," +
                          "linear-gradient(45deg,transparent 75%,rgb(243,244,246) 75%)," +
                          "linear-gradient(-45deg,transparent 75%,rgb(243,244,246) 75%)",
                        backgroundSize: "20px 20px",
                        backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
                      }}
                    >
                      {!isEmpty && previewContent ? (
                        <div class="flex h-full w-full items-center justify-center">
                          <div
                            style={{
                              width: `${Math.min(previewSize.value, 260)}px`,
                              height: `${Math.min(previewSize.value, 260)}px`,
                            }}
                          >
                            <SvgPreview
                              content={previewContent}
                              class="h-full w-full object-contain"
                              loading="eager"
                            />
                          </div>
                        </div>
                      ) : (
                        <div class="flex h-full flex-col items-center justify-center gap-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            class="text-base-content/20"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          <p class="text-base-content/40 text-sm">暂无可预览的 SVG 内容</p>
                        </div>
                      )}
                    </div>

                    {/* Right: quick color options */}
                    <div class="flex flex-1 flex-col gap-4">
                      {/* Grayscale */}
                      <div>
                        <p class="text-base-content/50 mb-2 text-[11px] font-semibold uppercase tracking-wider">
                          灰度
                        </p>
                        <div class="flex gap-1.5">
                          {["#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff"].map(
                            (c) => (
                              <button
                                key={c}
                                class={[
                                  "h-8 flex-1 rounded-lg border-2 transition-all hover:scale-110 active:scale-95",
                                  fillColor.value === c
                                    ? "border-primary ring-primary/30 ring-2"
                                    : "border-base-300",
                                ].join(" ")}
                                style={{ backgroundColor: c }}
                                title={c}
                                onClick$={() => (fillColor.value = c)}
                              />
                            ),
                          )}
                        </div>
                      </div>

                      {/* Accent colors */}
                      <div>
                        <p class="text-base-content/50 mb-2 text-[11px] font-semibold uppercase tracking-wider">
                          彩色
                        </p>
                        <div class="grid grid-cols-6 gap-1.5">
                          {[
                            "#ef4444", "#f97316", "#eab308",
                            "#22c55e", "#3b82f6", "#8b5cf6",
                            "#ec4899", "#06b6d4", "#10b981",
                            "#f59e0b", "#6366f1", "#e11d48",
                          ].map((c) => (
                            <button
                              key={c}
                              class={[
                                "h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95",
                                fillColor.value === c
                                  ? "border-primary ring-primary/30 ring-2"
                                  : "border-base-300",
                              ].join(" ")}
                              style={{ backgroundColor: c }}
                              title={c}
                              onClick$={() => (fillColor.value = c)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Custom color picker */}
                      <div>
                        <p class="text-base-content/50 mb-2 text-[11px] font-semibold uppercase tracking-wider">
                          自定义
                        </p>
                        <div class="flex items-center gap-2">
                          <input
                            type="color"
                            class="border-base-300 h-9 w-9 cursor-pointer rounded-lg border-2 p-0.5"
                            value={fillColor.value}
                            onInput$={(e: any) => (fillColor.value = e.target.value)}
                          />
                          <code class="bg-base-100 flex-1 rounded-lg px-3 py-2 font-mono text-sm">
                            {fillColor.value}
                          </code>
                        </div>
                      </div>

                      {/* Preview size */}
                      <div>
                        <p class="text-base-content/50 mb-2 text-[11px] font-semibold uppercase tracking-wider">
                          图标大小
                        </p>
                        <select
                          class="select select-bordered select-sm w-full"
                          value={previewSize.value}
                          onChange$={(e: any) =>
                            (previewSize.value = Number(e.target.value))
                          }
                        >
                          <option value="32">32 px</option>
                          <option value="64">64 px</option>
                          <option value="96">96 px</option>
                          <option value="128">128 px</option>
                          <option value="192">192 px</option>
                          <option value="256">256 px（最大）</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {!svgIsValid.value && (
                    <div class="alert alert-error mt-4 py-2 text-sm">
                      当前 SVG 内容格式不正确，预览与保存会被禁用。
                    </div>
                  )}
                </div>
              </div>

              {/* Transform controls */}
              <div class="card bg-base-200 border-base-300 border shadow-sm">
                <div class="card-body p-5">
                  <h4 class="mb-3 flex items-center gap-2 text-sm font-medium">
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
                      <polyline points="5 9 2 12 5 15" />
                      <polyline points="9 5 12 2 15 5" />
                      <polyline points="15 19 12 22 9 19" />
                      <polyline points="19 9 22 12 19 15" />
                      <line x1="2" x2="22" y1="12" y2="12" />
                      <line x1="12" x2="12" y1="2" y2="22" />
                    </svg>
                    变换
                  </h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text text-xs">缩放 X</span>
                      </label>
                      <input
                        type="number"
                        class="input input-bordered input-sm"
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={transform.scaleX}
                        onInput$={(e: any) =>
                          (transform.scaleX = parseFloat(e.target.value) || 1)
                        }
                      />
                    </div>
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text text-xs">缩放 Y</span>
                      </label>
                      <input
                        type="number"
                        class="input input-bordered input-sm"
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={transform.scaleY}
                        onInput$={(e: any) =>
                          (transform.scaleY = parseFloat(e.target.value) || 1)
                        }
                      />
                    </div>
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text text-xs">旋转 (°)</span>
                      </label>
                      <input
                        type="number"
                        class="input input-bordered input-sm"
                        step="1"
                        min="-360"
                        max="360"
                        value={transform.rotate}
                        onInput$={(e: any) =>
                          (transform.rotate = parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text text-xs">偏移 X</span>
                      </label>
                      <input
                        type="number"
                        class="input input-bordered input-sm"
                        step="1"
                        value={transform.translateX}
                        onInput$={(e: any) =>
                          (transform.translateX =
                            parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div class="form-control">
                      <label class="label">
                        <span class="label-text text-xs">偏移 Y</span>
                      </label>
                      <input
                        type="number"
                        class="input input-bordered input-sm"
                        step="1"
                        value={transform.translateY}
                        onInput$={(e: any) =>
                          (transform.translateY =
                            parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div class="flex items-end gap-1">
                      <button
                        class="btn btn-outline btn-sm"
                        title="水平翻转"
                        onClick$={() => {
                          transform.scaleX = (transform.scaleX || 1) * -1;
                        }}
                      >
                        ↔
                      </button>
                      <button
                        class="btn btn-outline btn-sm"
                        title="垂直翻转"
                        onClick$={() => {
                          transform.scaleY = (transform.scaleY || 1) * -1;
                        }}
                      >
                        ↕
                      </button>
                      <button
                        class="btn btn-outline btn-sm"
                        onClick$={() => {
                          transform.scaleX = 1;
                          transform.scaleY = 1;
                          transform.rotate = 0;
                          transform.translateX = 0;
                          transform.translateY = 0;
                        }}
                      >
                        重置
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Settings */}
            <div class="flex min-w-0 flex-col gap-4">
              {/* Basic info */}
              <div class="card bg-base-200 border-base-300 border shadow-sm">
                <div class="card-body p-5">
                  <h4 class="mb-3 flex items-center gap-2 text-sm font-medium">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" x2="12" y1="8" y2="12" />
                      <line x1="12" x2="12.01" y1="16" y2="16" />
                    </svg>
                    基本信息
                  </h4>
                  <div class="space-y-3">
                    <div class="form-control">
                      <label class="label justify-start pb-2">
                        <span class="label-text text-xs">图标名称</span>
                      </label>
                      <input
                        type="text"
                        class={`input input-bordered input-sm ${!nameIsValid.value ? "input-error" : ""}`}
                        placeholder="例如: home, user, settings"
                        value={name.value}
                        onInput$={(e: any) => (name.value = e.target.value)}
                      />
                      {!nameIsValid.value && (
                        <label class="label">
                          <span class="label-text-alt text-error text-xs">
                            仅允许字母、数字、连字符和下划线
                          </span>
                        </label>
                      )}
                    </div>
                    <div class="form-control">
                      <label class="label justify-start pb-2">
                        <span class="label-text text-xs">Unicode</span>
                      </label>
                      <div class="flex gap-2">
                        <input
                          type="text"
                          class="input input-bordered input-sm flex-1"
                          placeholder="例如: e001"
                          value={unicode.value.replace(/^&#x|;$/g, "")}
                          onInput$={(e: any) => {
                            const val = e.target.value
                              .replace(/[^a-fA-F0-9]/g, "")
                              .slice(0, 4);
                            unicode.value = val ? `&#x${val};` : "";
                          }}
                        />
                        <button
                          class="btn btn-outline btn-sm"
                          title="自动生成"
                          onClick$={() => {
                            const code = (0xe000 + (icon.id || 0)).toString(16);
                            unicode.value = `&#x${code};`;
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div class="form-control">
                      <label class="label justify-start pb-2">
                        <span class="label-text text-xs">标签（逗号分隔）</span>
                      </label>
                      <input
                        type="text"
                        class="input input-bordered input-sm"
                        placeholder="例如: outline, filled, basic"
                        value={tags.value}
                        onInput$={(e: any) => (tags.value = e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ViewBox */}
              <div class="card bg-base-200 border-base-300 border shadow-sm">
                <div class="card-body p-5">
                  <h4 class="mb-3 flex items-center justify-between text-sm font-medium">
                    <span class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <line x1="3" x2="21" y1="9" y2="9" />
                        <line x1="9" x2="9" y1="21" y2="9" />
                      </svg>
                      视图框
                    </span>
                    <button
                      class="btn btn-outline btn-xs"
                      onClick$={detectViewBox}
                    >
                      从SVG检测
                    </button>
                  </h4>
                  <div class="space-y-3">
                    <div class="form-control">
                      <label class="label justify-start pb-2">
                        <span class="label-text text-xs">ViewBox</span>
                      </label>
                      <input
                        type="text"
                        class="input input-bordered input-sm font-mono text-xs"
                        placeholder="0 0 1024 1024"
                        value={viewBox.value}
                        onInput$={(e: any) => {
                          viewBox.value = e.target.value;
                        }}
                      />
                    </div>
                    <div class="grid grid-cols-4 gap-2">
                      <div class="form-control">
                        <label class="label justify-start pb-2">
                          <span class="label-text text-xs">X</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm"
                          value={viewBoxParts.minX}
                          onInput$={(e: any) => {
                            viewBoxParts.minX = parseFloat(e.target.value) || 0;
                            syncViewBox();
                          }}
                        />
                      </div>
                      <div class="form-control">
                        <label class="label justify-start pb-2">
                          <span class="label-text text-xs">Y</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm"
                          value={viewBoxParts.minY}
                          onInput$={(e: any) => {
                            viewBoxParts.minY = parseFloat(e.target.value) || 0;
                            syncViewBox();
                          }}
                        />
                      </div>
                      <div class="form-control">
                        <label class="label justify-start pb-2">
                          <span class="label-text text-xs">宽</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm"
                          value={viewBoxParts.vbWidth}
                          onInput$={(e: any) => {
                            viewBoxParts.vbWidth =
                              parseFloat(e.target.value) || 1024;
                            syncViewBox();
                          }}
                        />
                      </div>
                      <div class="form-control">
                        <label class="label justify-start pb-2">
                          <span class="label-text text-xs">高</span>
                        </label>
                        <input
                          type="number"
                          class="input input-bordered input-sm"
                          value={viewBoxParts.vbHeight}
                          onInput$={(e: any) => {
                            viewBoxParts.vbHeight =
                              parseFloat(e.target.value) || 1024;
                            syncViewBox();
                          }}
                        />
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-1">
                      {[
                        "16 16",
                        "24 24",
                        "32 32",
                        "48 48",
                        "64 64",
                        "512 512",
                        "1024 1024",
                      ].map((p) => (
                        <button
                          key={p}
                          class="btn btn-outline btn-xs"
                          onClick$={() => {
                            viewBox.value = `0 0 ${p}`;
                            const [pw, ph] = p.split(" ").map(Number);
                            viewBoxParts.minX = 0;
                            viewBoxParts.minY = 0;
                            viewBoxParts.vbWidth = pw;
                            viewBoxParts.vbHeight = ph;
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SVG Code */}
              <div class="card bg-base-200 border-base-300 border shadow-sm">
                <div class="card-body p-5">
                  <h4 class="mb-3 flex items-center justify-between text-sm font-medium">
                    <span class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                      SVG 代码
                      {!svgIsValid.value && (
                        <span class="badge badge-error badge-xs">格式错误</span>
                      )}
                    </span>
                    <div class="flex items-center gap-2">
                      <button
                        class="btn btn-outline btn-xs"
                        title="复制 SVG 代码"
                        onClick$={async () => {
                          await navigator.clipboard.writeText(svgContent.value);
                          copiedSvg.value = true;
                          setTimeout(() => (copiedSvg.value = false), 1500);
                        }}
                      >
                        {copiedSvg.value ? "已复制!" : "复制"}
                      </button>
                      <label class="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-xs"
                          checked={showRawCode.value}
                          onChange$={() =>
                            (showRawCode.value = !showRawCode.value)
                          }
                        />
                        编辑模式
                      </label>
                    </div>
                  </h4>
                  {showRawCode.value ? (
                    <textarea
                      class={`textarea textarea-bordered min-h-55 w-full font-mono text-xs ${!svgIsValid.value ? "textarea-error" : ""}`}
                      placeholder="SVG 代码..."
                      value={svgContent.value}
                      onInput$={(e: any) => {
                        svgContent.value = e.target.value;
                        detectViewBox();
                      }}
                    />
                  ) : (
                    <pre class="bg-base-100 border-base-300 rounded-box max-h-64 overflow-auto border p-3 font-mono text-xs">
                      {svgContent.value || "无 SVG 内容"}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="border-base-200 bg-base-200/60 flex items-center justify-between border-t px-6 py-4">
          <div class="text-base-content/60 text-xs">
            <kbd class="kbd kbd-xs">Ctrl+S</kbd> 保存 ·{" "}
            <kbd class="kbd kbd-xs">Esc</kbd> 关闭
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost" onClick$={handleClose}>
              取消
            </button>
            <button
              class="btn btn-primary"
              onClick$={handleSave}
              disabled={!nameIsValid.value || !svgIsValid.value}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              保存
            </button>
          </div>
        </div>
      </div>

      {/* Confirm close with unsaved changes */}
      {showCloseConfirm.value && (
        <div class="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div class="modal-box bg-base-100 w-full max-w-sm rounded-2xl shadow-2xl">
            <h4 class="mb-2 text-base font-bold">放弃未保存的修改？</h4>
            <p class="text-base-content/60 mb-4 text-sm">
              你对图标所做的修改尚未保存，关闭后将会丢失。
            </p>
            <div class="flex justify-end gap-2">
              <button
                class="btn btn-sm"
                onClick$={() => (showCloseConfirm.value = false)}
              >
                继续编辑
              </button>
              <button
                class="btn btn-sm btn-error"
                onClick$={() => {
                  showCloseConfirm.value = false;
                  onClose$();
                }}
              >
                放弃修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
