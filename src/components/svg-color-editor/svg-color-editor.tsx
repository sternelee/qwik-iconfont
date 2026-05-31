/**
 * SvgColorEditor — interactive path-level colour editor.
 *
 * Renders the SVG with all its original fill colours, lets the user
 * click any path to select it, and provides a colour picker to change
 * that path's fill.  Changes are written back into the SVG and
 * reported to the parent via `onChangeSvg$`.
 *
 * DOM strategy (Qwik):
 *  – Container div renders the SVG via `innerHTML` in `useVisibleTask$`.
 *  – Click + hover handlers are wired via native `addEventListener`.
 *  – `selectedIdx` signal bridges DOM → Qwik reactive world.
 *  – `pendingSvg` signal triggers `useTask$` → calls the prop QRL.
 */
import {
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
  $,
  type QRL,
} from "@builder.io/qwik";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PathEntry {
  idx: number;
  tag: string;       // "path" | "rect" | "circle" ...
  fill: string;      // current fill value
}

export interface SvgColorEditorProps {
  /** Raw SVG string. Read once on mount; later changes are internal. */
  initialSvg: string;
  /** Called with the updated SVG string after every colour change. */
  onChangeSvg$: QRL<(svg: string) => void>;
}

// ── SVG sanitise + mount helpers ───────────────────────────────────────────

/**
 * Parse an SVG string with DOMParser, strip dangerous elements/attributes,
 * and return the root <svg> element (or null on failure).
 * Using DOMParser (not innerHTML) avoids direct XSS injection.
 */
function parseSanitisedSvg(raw: string): SVGSVGElement | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;
    // Strip <script> and <foreignObject> (potential XSS vectors)
    svg.querySelectorAll("script, foreignObject").forEach((el) => el.remove());
    // Strip on* event attributes and javascript: hrefs
    svg.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (
          attr.name.startsWith("on") ||
          attr.value.toLowerCase().startsWith("javascript:")
        ) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return svg as SVGSVGElement;
  } catch {
    return null;
  }
}

/** Serialise an SVG element back to a string without outerHTML. */
function serialiseSvg(svg: Element): string {
  return new XMLSerializer().serializeToString(svg);
}

const SHAPE_SELECTOR =
  "path, rect, circle, ellipse, line, polyline, polygon, use";

/** Read the effective fill attribute (checks `fill` attr + `style` property). */
function getElementFill(el: Element): string {
  const style = el.getAttribute("style") || "";
  const styleMatch = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  if (styleMatch) return styleMatch[1].trim();
  return el.getAttribute("fill") || "currentColor";
}

/** Set the fill on an element, preferring the `fill` attribute. */
function setElementFill(el: Element, color: string) {
  // Also clear fill from style attr to avoid conflict
  const style = el.getAttribute("style") || "";
  const cleaned = style.replace(/(?:^|;)\s*fill\s*:[^;]*/gi, "").replace(/^;+|;+$/g, "");
  if (cleaned) el.setAttribute("style", cleaned);
  else el.removeAttribute("style");
  el.setAttribute("fill", color);
}

const HIGHLIGHT_FILTER =
  "drop-shadow(0 0 4px rgba(225,29,72,0.9)) drop-shadow(0 0 2px rgba(225,29,72,0.6))";

// ── Component ────────────────────────────────────────────────────────────────

export const SvgColorEditor = component$<SvgColorEditorProps>(
  ({ initialSvg, onChangeSvg$ }) => {
    const containerRef = useSignal<Element>();
    const selectedIdx = useSignal(-1);
    const entries = useSignal<PathEntry[]>([]);
    /** Bridges DOM mutation → Qwik reactive → prop QRL call. */
    const pendingSvg = useSignal<string>("");

    // ── Phase 1: mount SVG + wire event listeners ──────────────────
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      const container = containerRef.value;
      if (!container) return;

      // Use parseSanitisedSvg (DOMParser, not innerHTML) to prevent XSS
      const svgEl = parseSanitisedSvg(initialSvg);
      if (!svgEl) return;
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%");
      svgEl.style.display = "block";
      container.appendChild(document.adoptNode(svgEl));
      const svg = container.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;

      const shapes = Array.from(svg.querySelectorAll(SHAPE_SELECTOR)) as Element[];

      // Build entries list (skip fill="none")
      const list: PathEntry[] = [];
      shapes.forEach((el, i) => {
        const fill = getElementFill(el);
        if (fill === "none") return;
        list.push({ idx: i, tag: el.tagName.toLowerCase(), fill });
        (el as HTMLElement).style.cursor = "pointer";
        (el as HTMLElement).style.transition = "opacity 0.12s";

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          selectedIdx.value = i;
        });
        el.addEventListener("mouseenter", () => {
          if (selectedIdx.value !== i) {
            (el as HTMLElement).style.opacity = "0.75";
          }
        });
        el.addEventListener("mouseleave", () => {
          (el as HTMLElement).style.opacity = "";
        });
      });

      entries.value = list;
    });

    // ── Phase 2: sync highlight when selectedIdx changes ──────────
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const sel = track(() => selectedIdx.value);
      const container = containerRef.value;
      if (!container) return;
      const svg = container.querySelector("svg");
      if (!svg) return;
      const shapes = Array.from(svg.querySelectorAll(SHAPE_SELECTOR));
      shapes.forEach((el, i) => {
        (el as SVGElement).style.filter = i === sel ? HIGHLIGHT_FILTER : "";
        (el as HTMLElement).style.opacity = "";
      });
    });

    // ── Phase 3: emit SVG string to parent when pendingSvg changes ─
    useTask$(async ({ track }) => {
      const svg = track(() => pendingSvg.value);
      if (svg) await onChangeSvg$(svg);
    });

    // ── Colour change handler ───────────────────────────────────────
    const applyColor = $((shapeIdx: number, newColor: string) => {
      const container = containerRef.value;
      if (!container) return;
      const svg = container.querySelector("svg");
      if (!svg) return;
      const shapes = Array.from(
        svg.querySelectorAll(SHAPE_SELECTOR),
      ) as Element[];
      const el = shapes[shapeIdx];
      if (!el) return;

      setElementFill(el, newColor);

      // Update entries list
      entries.value = entries.value.map((e) =>
        e.idx === shapeIdx ? { ...e, fill: newColor } : e,
      );

      // Trigger parent notification
      pendingSvg.value = serialiseSvg(svg);
    });

    const selEntry =
      selectedIdx.value >= 0
        ? entries.value.find((e) => e.idx === selectedIdx.value)
        : null;

    // ── Render ──────────────────────────────────────────────────────
    return (
      <div class="flex flex-col gap-3">
        {/* Top bar */}
        <div class="flex items-center gap-2 text-xs text-rose-500">
          <span class="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-600">
            🎨 彩色模式
          </span>
          {selectedIdx.value < 0
            ? "点击 SVG 中任意路径以编辑颜色"
            : `已选 ${selEntry?.tag ?? "path"} · 共 ${entries.value.length} 个路径`}
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          {/* SVG canvas */}
          <div
            class="relative flex-1 overflow-hidden rounded-2xl border border-rose-100 bg-white"
            style={{ minHeight: "280px" }}
          >
            {/* Checkerboard background */}
            <div
              class="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#f3f4f6 25%,transparent 25%)," +
                  "linear-gradient(-45deg,#f3f4f6 25%,transparent 25%)," +
                  "linear-gradient(45deg,transparent 75%,#f3f4f6 75%)," +
                  "linear-gradient(-45deg,transparent 75%,#f3f4f6 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              }}
            />
            <div
              ref={containerRef}
              class="relative h-full w-full p-2"
              style={{ minHeight: "280px" }}
            />
          </div>

          {/* Side panel: path swatches + colour picker */}
          <div class="flex w-52 shrink-0 flex-col gap-2">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
              颜色图层
            </p>

            <div class="max-h-48 space-y-1 overflow-y-auto pr-1">
              {entries.value.map((e) => {
                const isSel = selectedIdx.value === e.idx;
                return (
                  <button
                    key={e.idx}
                    class={[
                      "flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-all",
                      isSel
                        ? "border-rose-400 bg-rose-50 ring-1 ring-rose-300"
                        : "border-rose-100 bg-white hover:border-rose-200",
                    ].join(" ")}
                    onClick$={() => (selectedIdx.value = e.idx)}
                    title={`${e.tag} · ${e.fill}`}
                  >
                    <span
                      class="h-4 w-4 shrink-0 rounded-md border border-rose-100"
                      style={{ backgroundColor: e.fill === "currentColor" ? "#111" : e.fill }}
                    />
                    <span class="min-w-0 flex-1 truncate font-mono text-[10px] text-rose-700">
                      {e.fill}
                    </span>
                    <span class="shrink-0 text-[9px] text-rose-300">
                      {e.tag.slice(0, 4)}
                    </span>
                  </button>
                );
              })}
              {entries.value.length === 0 && (
                <p class="py-3 text-center text-xs text-rose-300">加载中...</p>
              )}
            </div>

            {/* Colour picker for selected path */}
            {selEntry && (
              <div class="rounded-2xl border border-rose-100 bg-rose-50/60 p-3">
                <p class="mb-2 text-[11px] font-semibold text-rose-500">
                  修改颜色
                </p>
                <div class="flex items-center gap-2">
                  <input
                    type="color"
                    class="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-rose-200 p-0.5"
                    value={
                      selEntry.fill === "currentColor"
                        ? "#111111"
                        : selEntry.fill
                    }
                    onInput$={(e) => {
                      const color = (e.target as HTMLInputElement).value;
                      applyColor(selEntry.idx, color);
                    }}
                  />
                  <input
                    type="text"
                    class="w-full rounded-xl border border-rose-100 bg-white px-2.5 py-1 font-mono text-xs text-rose-800 focus:border-rose-300 focus:outline-none"
                    value={selEntry.fill}
                    onBlur$={(e) => {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (/^#[0-9a-fA-F]{3,8}$/.test(val) || val === "currentColor") {
                        applyColor(selEntry.idx, val);
                      }
                    }}
                  />
                </div>
                <button
                  class="mt-2 w-full rounded-xl border border-rose-100 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-100"
                  onClick$={() => applyColor(selEntry.idx, selEntry.fill)}
                  title="所有相同颜色的路径"
                >
                  重置为原色
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

// ── Utility exported for svg-editor.tsx ─────────────────────────────────────

/** Quick regex check — does this SVG contain ≥ 2 distinct non-none fill values? */
export function svgHasMultipleColors(svg: string): boolean {
  const seen = new Set<string>();
  for (const m of svg.matchAll(/\bfill="([^"]+)"/gi)) {
    const f = m[1].toLowerCase().trim();
    if (f !== "none" && f !== "currentcolor") seen.add(f);
    if (seen.size > 1) return true;
  }
  return false;
}
