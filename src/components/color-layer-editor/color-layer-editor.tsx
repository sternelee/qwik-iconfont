/**
 * ColorLayerEditor — editor for COLRv0 colour layers of a single icon.
 *
 * Shows each colour layer as a row with:
 *   - SVG preview of that layer (coloured)
 *   - Colour swatch + hex input + native colour picker
 *   - Up/down reorder buttons
 *   - Delete button
 *
 * Parent passes `layers` and `onChange$` to control state.
 * Used inside the SVG editor when a multi-colour icon is detected on upload.
 */
import { component$, $, type QRL } from "@builder.io/qwik";
import type { StoredColorLayer } from "~/lib/svg-color-extractor";

// ── Types ────────────────────────────────────────────────────────────────────

export type { StoredColorLayer };

export interface ColorLayerEditorProps {
  layers: StoredColorLayer[];
  /** Called after every mutation with the updated layer list. */
  onChangeLayers$: QRL<(layers: StoredColorLayer[]) => void>;
}

// ── Sub-component: single layer row ─────────────────────────────────────────

function LayerPreviewSVG({ d, color }: { d: string; color: string }) {
  const fill = color === "currentColor" ? "#111827" : color;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      class="h-9 w-9 shrink-0"
      aria-hidden
    >
      <path d={d} fill={fill} />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export const ColorLayerEditor = component$<ColorLayerEditorProps>(
  ({ layers, onChangeLayers$ }) => {
    const moveUp = $(async (idx: number) => {
      if (idx === 0) return;
      const next = [...layers];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      await onChangeLayers$(next);
    });

    const moveDown = $(async (idx: number) => {
      if (idx >= layers.length - 1) return;
      const next = [...layers];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      await onChangeLayers$(next);
    });

    const deleteLayer = $(async (idx: number) => {
      await onChangeLayers$(layers.filter((_, i) => i !== idx));
    });

    const setColor = $(async (idx: number, color: string) => {
      const next = layers.map((l, i) => (i === idx ? { ...l, color } : l));
      await onChangeLayers$(next);
    });

    if (layers.length === 0) {
      return (
        <div class="rounded-md border border-dashed border-[var(--color-base-300)] bg-[var(--color-base-200)]/40 p-4 text-center text-sm text-[var(--color-base-400)]">
          无颜色图层
        </div>
      );
    }

    return (
      <div class="space-y-1.5">
        {/* Combined preview */}
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1000 1000"
              class="h-9 w-9"
              aria-hidden
            >
              {layers.map((l, i) => (
                <path
                  key={i}
                  d={l.d}
                  fill={l.color === "currentColor" ? "#111827" : l.color}
                />
              ))}
            </svg>
          </div>
          <div>
            <p class="text-[11px] font-semibold tracking-wide text-[var(--color-neutral)] uppercase">
              彩色预览
            </p>
            <p class="text-xs text-[var(--color-base-400)]">
              {layers.length} 个颜色图层 · COLRv0 格式
            </p>
          </div>
        </div>

        {/* Layer rows */}
        {layers.map((layer, idx) => {
          const displayColor =
            layer.color === "currentColor" ? "#111827" : layer.color;
          return (
            <div
              key={idx}
              class="flex items-center gap-2 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-3 py-2"
            >
              {/* Layer index badge */}
              <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-base-200)] text-[9px] font-bold text-[var(--color-neutral)]">
                {idx + 1}
              </span>

              {/* SVG preview of this layer */}
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-50 bg-[var(--color-base-200)]/40">
                <LayerPreviewSVG d={layer.d} color={layer.color} />
              </div>

              {/* Colour picker */}
              <div class="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                  type="color"
                  class="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-[var(--color-base-300)] p-0.5"
                  value={displayColor}
                  title="选择颜色"
                  onInput$={(e) =>
                    setColor(idx, (e.target as HTMLInputElement).value)
                  }
                />
                <input
                  type="text"
                  class="w-24 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-200)]/50 px-2 py-1 font-mono text-xs text-[var(--color-neutral)] focus:border-[var(--color-base-300)] focus:outline-none"
                  value={
                    layer.color === "currentColor"
                      ? "currentColor"
                      : displayColor
                  }
                  onBlur$={(e) => {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (
                      val === "currentColor" ||
                      /^#[0-9a-fA-F]{3,8}$/.test(val)
                    ) {
                      setColor(idx, val);
                    }
                  }}
                />
                {layer.color === "currentColor" && (
                  <span class="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">
                    前景色
                  </span>
                )}
              </div>

              {/* Reorder + delete */}
              <div class="flex shrink-0 items-center gap-0.5">
                <button
                  class="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-base-400)] hover:bg-[var(--color-base-200)] hover:text-[var(--color-neutral)] disabled:opacity-30"
                  title="上移"
                  disabled={idx === 0}
                  onClick$={() => moveUp(idx)}
                >
                  ↑
                </button>
                <button
                  class="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-base-400)] hover:bg-[var(--color-base-200)] hover:text-[var(--color-neutral)] disabled:opacity-30"
                  title="下移"
                  disabled={idx === layers.length - 1}
                  onClick$={() => moveDown(idx)}
                >
                  ↓
                </button>
                <button
                  class="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-base-400)] hover:bg-red-50 hover:text-red-500"
                  title="删除此图层"
                  onClick$={() => deleteLayer(idx)}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        <p class="pt-1 text-[11px] text-[var(--color-base-400)]">
          图层从下到上叠加渲染 · 支持 IE9 / iOS 11+
        </p>
      </div>
    );
  },
);

// ── Utility: detect multi-colour SVG on the client ──────────────────────────

/**
 * Detect if an SVG has multiple distinct fill colours.
 * Returns the extracted colour layers if multi-colour, or null if monochrome.
 *
 * Runs browser-side only (uses DOMParser via svg-color-extractor).
 */
export async function detectColorLayers(
  svgContent: string,
): Promise<StoredColorLayer[] | null> {
  const { extractSVGColorLayers, mergeLayerPaths } =
    await import("~/lib/svg-color-extractor");
  const { layers, isMultiColor } = extractSVGColorLayers(svgContent);
  if (!isMultiColor || layers.length < 2) return null;

  // Merge per-layer paths into single `d` strings
  const stored: StoredColorLayer[] = [];
  for (const layer of layers) {
    const d = await mergeLayerPaths(layer);
    if (d) stored.push({ color: layer.color, d });
  }
  return stored.length >= 2 ? stored : null;
}
