import { component$, useSignal, type QRL } from "@builder.io/qwik";
import type { Icon } from "~/lib/types";
import { SvgPreview } from "~/components/svg-preview/svg-preview";

interface IconDetailPanelProps {
  icon: Partial<Icon>;
  onEdit$: QRL<(icon: Partial<Icon>) => void>;
  onDelete$: QRL<(id: number) => void>;
  onClose$: QRL<() => void>;
  prefix?: string;
  fontFamily?: string;
}

export const IconDetailPanel = component$((props: IconDetailPanelProps) => {
  const { icon, onEdit$, onDelete$, onClose$ } = props;

  const previewSize = useSignal(96);
  const fillColor = useSignal("#000000");
  const showRawContent = useSignal(false);

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="modal-box animate-modal-box bg-base-100 w-full max-w-md shadow-xl">
        {/* Header */}
        <div class="flex items-center justify-between border-b p-4">
          <h3 class="flex items-center gap-2 text-lg font-semibold">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {icon.name}
          </h3>
          <button class="btn btn-ghost btn-sm btn-square" onClick$={onClose$}>
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

        {/* Preview */}
        <div class="flex flex-col items-center gap-4 p-6">
          {/* Preview size selector */}
          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-500">预览大小:</span>
            <input
              type="range"
              min="16"
              max="256"
              value={previewSize.value}
              class="range range-xs w-32"
              onInput$={(e: any) =>
                (previewSize.value = Number(e.target.value))
              }
            />
            <span class="font-mono text-xs">{previewSize.value}px</span>
          </div>

          {/* Icon preview */}
          <div
            class="bg-base-200 flex items-center justify-center rounded-lg border p-8"
            style={{
              width: `${previewSize.value + 64}px`,
              height: `${previewSize.value + 64}px`,
            }}
          >
            <div
              class="flex items-center justify-center"
              style={{
                width: `${previewSize.value}px`,
                height: `${previewSize.value}px`,
              }}
            >
              <SvgPreview
                content={icon.content ?? null}
                color={fillColor.value}
                class="h-full w-full object-contain"
              />
            </div>
          </div>

          {/* Color picker */}
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">颜色:</span>
            <input
              type="color"
              class="h-8 w-8 cursor-pointer rounded border-0"
              value={fillColor.value}
              onInput$={(e: any) => (fillColor.value = e.target.value)}
            />
            <div class="flex flex-wrap gap-1">
              {[
                "#000000",
                "#333333",
                "#666666",
                "#999999",
                "#cccccc",
                "#ffffff",
                "#ef4444",
                "#f97316",
                "#eab308",
                "#22c55e",
                "#3b82f6",
                "#8b5cf6",
                "#ec4899",
              ].map((c) => (
                <button
                  key={c}
                  class="border-base-300 h-6 w-6 rounded border transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                  onClick$={() => (fillColor.value = c)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div class="border-t p-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs text-gray-500">名称</span>
              </label>
              <div class="font-mono text-sm">{icon.name}</div>
            </div>
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs text-gray-500">Unicode</span>
              </label>
              <div class="font-mono text-sm">
                {icon.unicode || <span class="text-gray-400">未设置</span>}
              </div>
            </div>
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs text-gray-500">ViewBox</span>
              </label>
              <div class="font-mono text-xs">
                {icon.view_box || "0 0 1024 1024"}
              </div>
            </div>
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs text-gray-500">尺寸</span>
              </label>
              <div class="font-mono text-xs">
                {icon.width && icon.height
                  ? `${icon.width} × ${icon.height}`
                  : "自动"}
              </div>
            </div>
            <div class="form-control col-span-2">
              <label class="label py-1">
                <span class="label-text text-xs text-gray-500">ID</span>
              </label>
              <div class="font-mono text-xs text-gray-400">#{icon.id}</div>
            </div>
          </div>

          {/* Usage code */}
          {props.prefix && (
            <div class="bg-base-200 mt-4 rounded-lg p-3">
              <label class="label py-1">
                <span class="label-text text-xs text-gray-500">使用方法</span>
              </label>
              <div class="space-y-2 font-mono text-xs">
                <div>
                  <span class="text-gray-500">Font class: </span>
                  <code class="text-primary">{`<i class="${props.prefix}${icon.name}"></i>`}</code>
                </div>
                <div>
                  <span class="text-gray-500">Symbol: </span>
                  <code class="text-secondary">{`<svg><use xlink:href="#${props.prefix}${icon.name}"></use></svg>`}</code>
                </div>
                {icon.unicode && (
                  <div>
                    <span class="text-gray-500">Unicode: </span>
                    <code>{icon.unicode}</code>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SVG Content (collapsible) */}
        <div class="border-t px-4 py-2">
          <button
            class="flex w-full items-center justify-between py-2 text-sm"
            onClick$={() => (showRawContent.value = !showRawContent.value)}
          >
            <span class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              SVG 代码
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class={`transition-transform ${showRawContent.value ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showRawContent.value && (
            <pre class="bg-base-200 mb-2 max-h-40 overflow-auto rounded p-2 font-mono text-xs">
              {icon.content || "无内容"}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div class="flex items-center justify-between border-t p-4">
          <button
            class="btn btn-error btn-outline btn-sm gap-1"
            onClick$={() => onDelete$(icon.id!)}
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            删除
          </button>
          <button
            class="btn btn-primary btn-sm gap-1"
            onClick$={() => onEdit$(icon)}
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
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            编辑
          </button>
        </div>
      </div>
    </div>
  );
});
