/**
 * SvgColorEditor — interactive path-level colour editor.
 *
 * Full-width SVG canvas that fills the available space, with a compact
 * colour-control bar below. Click any path to select it, then change its
 * colour via the picker or hex input.
 *
 * DOM strategy:
 *  – SVG is mounted via DOMParser + appendChild (no innerHTML) to prevent XSS.
 *  – Click / hover handlers are wired via native addEventListener.
 *  – `selectedIdx` bridges DOM→Qwik reactive world.
 *  – `pendingSvg` triggers useTask$ → calls the onChangeSvg$ QRL.
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
  tag: string;
  fill: string;
}

export interface SvgColorEditorProps {
  initialSvg: string;
  onChangeSvg$: QRL<(svg: string) => void>;
  /** Called when the user clicks the exit button. */
  onExit$: QRL<() => void>;
}

// ── SVG sanitisation ─────────────────────────────────────────────────────────

function parseSanitisedSvg(raw: string): SVGSVGElement | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;
    svg.querySelectorAll("script, foreignObject").forEach((el) => el.remove());
    svg.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (
          attr.name.startsWith("on") ||
          attr.value.toLowerCase().startsWith("javascript:")
        )
          el.removeAttribute(attr.name);
      }
    });
    return svg as SVGSVGElement;
  } catch {
    return null;
  }
}

function serialiseSvg(svg: Element): string {
  return new XMLSerializer().serializeToString(svg);
}

// ── Fill helpers ─────────────────────────────────────────────────────────────

const SHAPE_SELECTOR =
  "path, rect, circle, ellipse, line, polyline, polygon, use";

function getElementFill(el: Element): string {
  const style = el.getAttribute("style") || "";
  const m = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  if (m) return m[1].trim();
  return el.getAttribute("fill") || "currentColor";
}

function setElementFill(el: Element, color: string) {
  const style = el.getAttribute("style") || "";
  const cleaned = style
    .replace(/(?:^|;)\s*fill\s*:[^;]*/gi, "")
    .replace(/^;+|;+$/g, "");
  if (cleaned) el.setAttribute("style", cleaned);
  else el.removeAttribute("style");
  el.setAttribute("fill", color);
}

const SEL_FILTER =
  "drop-shadow(0 0 4px rgba(225,29,72,0.9)) drop-shadow(0 0 2px rgba(225,29,72,0.5))";

// ── Component ────────────────────────────────────────────────────────────────

export const SvgColorEditor = component$<SvgColorEditorProps>(
  ({ initialSvg, onChangeSvg$, onExit$ }) => {
    const containerRef = useSignal<Element>();
    const selectedIdx = useSignal(-1);
    const entries = useSignal<PathEntry[]>([]);
    const pendingSvg = useSignal("");

    // ── Mount: parse SVG, wire events ──────────────────────────────
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      const container = containerRef.value;
      if (!container) return;

      const svgEl = parseSanitisedSvg(initialSvg);
      if (!svgEl) return;

      // Only override width; keep the viewBox so the browser
      // computes height from the aspect ratio automatically.
      // Setting height="100%" on an SVG with no explicit parent height
      // causes the SVG to shrink to 0 — so we DON'T set it.
      svgEl.removeAttribute("width");
      svgEl.removeAttribute("height");
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%"); // parent is 420u00d7420 u2014 explicit size
      svgEl.style.display = "block";
      container.appendChild(document.adoptNode(svgEl));

      const svg = container.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;

      const shapes = Array.from(
        svg.querySelectorAll(SHAPE_SELECTOR),
      ) as Element[];

      const list: PathEntry[] = [];
      shapes.forEach((el, i) => {
        const fill = getElementFill(el);
        if (fill === "none") return;
        list.push({ idx: i, tag: el.tagName.toLowerCase(), fill });
        (el as HTMLElement).style.cursor = "pointer";
        (el as HTMLElement).style.transition = "opacity 0.1s, filter 0.1s";

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          selectedIdx.value = i;
        });
        el.addEventListener("mouseenter", () => {
          if (selectedIdx.value !== i)
            (el as HTMLElement).style.opacity = "0.72";
        });
        el.addEventListener("mouseleave", () => {
          (el as HTMLElement).style.opacity = "";
        });
      });

      entries.value = list;
    });

    // ── Sync highlight when selectedIdx changes ────────────────────
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const sel = track(() => selectedIdx.value);
      const container = containerRef.value;
      if (!container) return;
      const svg = container.querySelector("svg");
      if (!svg) return;
      Array.from(svg.querySelectorAll(SHAPE_SELECTOR)).forEach((el, i) => {
        (el as SVGElement).style.filter = i === sel ? SEL_FILTER : "";
        if (i !== sel) (el as HTMLElement).style.opacity = "";
      });
    });

    // ── Emit SVG to parent via pendingSvg bridge ───────────────────
    useTask$(async ({ track }) => {
      const svg = track(() => pendingSvg.value);
      if (svg) await onChangeSvg$(svg);
    });

    // ── Apply colour change ────────────────────────────────────────
    const applyColor = $((shapeIdx: number, color: string) => {
      const svg = containerRef.value?.querySelector("svg");
      if (!svg) return;
      const el = Array.from(svg.querySelectorAll(SHAPE_SELECTOR))[shapeIdx] as
        | Element
        | undefined;
      if (!el) return;
      setElementFill(el, color);
      entries.value = entries.value.map((e) =>
        e.idx === shapeIdx ? { ...e, fill: color } : e,
      );
      pendingSvg.value = serialiseSvg(svg);
    });

    const sel = selectedIdx.value;
    const selEntry = sel >= 0 ? entries.value.find((e) => e.idx === sel) : null;

    // ── Render ──────────────────────────────────────────────────────
    return (
      <div class="flex gap-3">

        {/* 420×420 fixed canvas — absolute-positioned SVG fills it */}
        <div
          class="relative shrink-0 overflow-hidden rounded-2xl border border-rose-100 bg-white"
          style={{ width: "420px", height: "420px" }}
        >
          {/* Checkerboard */}
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
          {/* SVG mounts here — fills 420×420 via absolute inset */}
          <div ref={containerRef} class="absolute inset-0 p-3" />
        </div>

        {/* Colour panel */}
        <div class="flex min-w-0 flex-1 flex-col gap-3">
          {/* Header: label + exit button */}
          <div class="flex items-center justify-between">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
              {sel < 0 ? "👆 点击路径选择" : `已选 · 路径 ${sel + 1} · ${selEntry?.tag}`}
            </p>
            <button
              class="flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-50 active:scale-95"
              onClick$={onExit$}
            >
              ← 退出彩色编辑
            </button>
          </div>

          {/* Path swatches */}
          <div class="flex flex-wrap gap-1.5">
            {entries.value.map((e) => {
              const isSel = selectedIdx.value === e.idx;
              const displayColor = e.fill === "currentColor" ? "#111" : e.fill;
              return (
                <button
                  key={e.idx}
                  class={[
                    "h-6 w-6 rounded-lg border-2 transition-all",
                    isSel
                      ? "border-rose-500 ring-2 ring-rose-300 ring-offset-1"
                      : "border-white hover:border-rose-300",
                  ].join(" ")}
                  style={{ backgroundColor: displayColor }}
                  title={`路径 ${e.idx + 1}: ${e.fill}`}
                  onClick$={() => (selectedIdx.value = e.idx)}
                />
              );
            })}
          </div>

          {/* Picker for selected */}
          {selEntry && (
            <div class="flex flex-col gap-2 rounded-2xl border border-rose-100 bg-rose-50/60 p-3">
              <p class="text-[11px] font-semibold text-rose-500">修改颜色</p>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  class="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-rose-200 p-0.5"
                  value={selEntry.fill === "currentColor" ? "#111111" : selEntry.fill}
                  onInput$={(e) =>
                    applyColor(selEntry.idx, (e.target as HTMLInputElement).value)
                  }
                />
                <input
                  type="text"
                  class="w-full rounded-xl border border-rose-100 bg-white px-2.5 py-1 font-mono text-xs text-rose-800 focus:border-rose-300 focus:outline-none"
                  value={selEntry.fill}
                  onBlur$={(e) => {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (/^#[0-9a-fA-F]{3,8}$/.test(v) || v === "currentColor")
                      applyColor(selEntry.idx, v);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

// ── Exported utility ─────────────────────────────────────────────────────────

export function svgHasMultipleColors(svg: string): boolean {
  const seen = new Set<string>();
  for (const m of svg.matchAll(/\bfill="([^"]+)"/gi)) {
    const f = m[1].toLowerCase().trim();
    if (f !== "none" && f !== "currentcolor") seen.add(f);
    if (seen.size > 1) return true;
  }
  return false;
}
