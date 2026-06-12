import { component$, useSignal, type QRL } from "@builder.io/qwik";
import type { Icon } from "~/lib/types";
import { SvgPreview } from "~/components/svg-preview/svg-preview";

interface IconDetailPanelProps {
  icon: Partial<Icon>;
  onEdit$: QRL<(icon: Partial<Icon>) => void>;
  onDelete$: QRL<(id: number) => void>;
  onClose$: QRL<() => void>;
  onAIModify$?: QRL<(icon: Partial<Icon>) => void>;
  prefix?: string;
  fontFamily?: string;
}

function hasNativeColors(icon: Partial<Icon>): boolean {
  if (icon.color_layers) return true;

  const content = icon.content;
  if (!content) return false;

  const colors = new Set<string>();
  const attrRe = /\b(?:fill|stroke)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  const addColor = (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (
      !value ||
      value === "none" ||
      value === "currentcolor" ||
      value.startsWith("url(")
    ) {
      return;
    }
    colors.add(value);
  };

  while ((match = attrRe.exec(content))) addColor(match[1]);

  return colors.size > 1;
}

export const IconDetailPanel = component$((props: IconDetailPanelProps) => {
  const { icon, onEdit$, onDelete$, onClose$, onAIModify$ } = props;

  const previewSize = useSignal(96);
  const fillColor = useSignal("#E11D48");
  const showRawContent = useSignal(false);
  const isColorIcon = hasNativeColors(icon);

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(74, 4, 24, 0.4)",
        backdropFilter: "blur(4px)",
      }}
      onClick$={onClose$}
    >
      <div
        class="clay-card w-full max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-md"
        onClick$={(e: any) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between border-b border-[var(--color-base-300)] px-5 py-4">
          <h3 class="flex items-center gap-2 text-base font-bold text-[var(--color-neutral)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E11D48"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {icon.name}
          </h3>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-base-400)] transition-all hover:bg-[var(--color-base-200)] hover:text-[var(--color-neutral)]"
            onClick$={onClose$}
          >
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
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Preview */}
        <div class="flex flex-col items-center gap-4 px-5 py-6">
          {/* Preview size selector */}
          <div class="flex items-center gap-3">
            <span class="text-xs font-medium text-[var(--color-base-400)]">
              预览大小:
            </span>
            <input
              type="range"
              min="16"
              max="256"
              value={previewSize.value}
              class="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-[var(--color-base-200)] accent-[var(--color-neutral)]"
              onInput$={(e: any) =>
                (previewSize.value = Number(e.target.value))
              }
            />
            <span class="font-mono text-xs text-[var(--color-neutral)]">
              {previewSize.value}px
            </span>
          </div>

          {/* Icon preview */}
          <div class="max-w-full overflow-x-auto">
            <div
              class="icon-preview-canvas flex items-center justify-center"
              style={{
                width: `${previewSize.value + 64}px`,
                height: `${previewSize.value + 64}px`,
              backgroundColor: "rgb(255, 255, 255)",
              backgroundImage:
                "linear-gradient(45deg, rgb(243, 244, 246) 25%, transparent 25%), linear-gradient(-45deg, rgb(243, 244, 246) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(243, 244, 246) 75%), linear-gradient(-45deg, transparent 75%, rgb(243, 244, 246) 75%)",
              backgroundSize: "24px 24px",
              backgroundPosition: "0px 0px, 0px 12px, 12px -12px, -12px 0px",
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
                color={isColorIcon ? undefined : fillColor.value}
                class="h-full w-full object-contain"
              />
            </div>
            </div>
          </div>

          {/* Color picker */}
          {!isColorIcon && (
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-[var(--color-base-400)]">
                颜色:
              </span>
              <input
                type="color"
                class="h-8 w-8 cursor-pointer overflow-hidden rounded-full border-0 p-0 sm:h-6 sm:w-6"
                value={fillColor.value}
                onInput$={(e: any) => (fillColor.value = e.target.value)}
              />
              <div class="flex flex-wrap gap-1">
                {[
                  "#E11D48",
                  "#2563EB",
                  "#22C55E",
                  "#F59E0B",
                  "#A855F7",
                  "#EC4899",
                  "#333333",
                  "#000000",
                ].map((c) => (
                  <button
                    key={c}
                    class={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 sm:h-6 sm:w-6 ${fillColor.value === c ? "scale-110 border-[var(--color-base-300)]" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick$={() => (fillColor.value = c)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div class="border-t border-[var(--color-base-300)] px-5 py-4">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label class="mb-1 block text-[10px] font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
                名称
              </label>
              <div class="font-mono text-sm text-[var(--color-neutral)]">
                {icon.name}
              </div>
            </div>
            <div>
              <label class="mb-1 block text-[10px] font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
                Unicode
              </label>
              <div class="font-mono text-sm text-[var(--color-neutral)]">
                {icon.unicode || (
                  <span class="text-[var(--color-base-400)]">未设置</span>
                )}
              </div>
            </div>
            <div>
              <label class="mb-1 block text-[10px] font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
                ViewBox
              </label>
              <div class="font-mono text-xs text-[var(--color-neutral)]">
                {icon.view_box || "0 0 1024 1024"}
              </div>
            </div>
            <div>
              <label class="mb-1 block text-[10px] font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
                尺寸
              </label>
              <div class="font-mono text-xs text-[var(--color-neutral)]">
                {icon.width && icon.height
                  ? `${icon.width} × ${icon.height}`
                  : "自动"}
              </div>
            </div>
            <div class="col-span-2">
              <label class="mb-1 block text-[10px] font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
                ID
              </label>
              <div class="font-mono text-xs text-[var(--color-base-400)]">
                #{icon.id}
              </div>
            </div>
          </div>

          {/* Usage code */}
          {props.prefix && (
            <div class="mt-4 rounded-md bg-[var(--color-base-200)] p-3">
              <label class="mb-2 block text-[10px] font-semibold tracking-wider text-[var(--color-base-400)] uppercase">
                使用方法
              </label>
              <div class="space-y-1.5 font-mono text-xs">
                <div>
                  <span class="text-[var(--color-base-400)]">Font class: </span>
                  <code class="font-semibold text-[var(--color-neutral)]">{`<i class="${props.prefix}${icon.name}"></i>`}</code>
                </div>
                <div>
                  <span class="text-[var(--color-base-400)]">Symbol: </span>
                  <code class="font-semibold text-blue-500">{`<svg><use href="#${props.prefix}${icon.name}"></use></svg>`}</code>
                </div>
                {icon.unicode && (
                  <div>
                    <span class="text-[var(--color-base-400)]">Unicode: </span>
                    <code class="text-[var(--color-neutral)]">
                      {icon.unicode}
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SVG Content (collapsible) */}
        <div class="border-t border-[var(--color-base-300)] px-4 py-2">
          <button
            class="flex w-full items-center justify-between rounded-md py-2 text-sm font-medium text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
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
                stroke-linecap="round"
                stroke-linejoin="round"
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
              stroke-linecap="round"
              stroke-linejoin="round"
              class={`transition-transform duration-200 ${showRawContent.value ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showRawContent.value && (
            <pre class="mt-1 mb-2 max-h-40 overflow-auto rounded-md bg-[var(--color-neutral)] p-3 font-mono text-xs text-[var(--color-base-100)]">
              {icon.content || "无内容"}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div class="flex flex-wrap items-center gap-2 border-t border-[var(--color-base-300)] px-5 py-4">
          <button
            class="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
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
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            删除
          </button>
          {onAIModify$ && (
            <button
              class="flex items-center gap-1.5 rounded-md bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-600 transition-all hover:bg-violet-100"
              onClick$={() => onAIModify$(icon)}
            >
              ✨ AI 修改
            </button>
          )}
          <button
            class="clay-button ml-auto flex items-center gap-1.5 rounded-md bg-rose-500 px-5 py-2 text-sm font-bold text-white"
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
              stroke-linecap="round"
              stroke-linejoin="round"
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
