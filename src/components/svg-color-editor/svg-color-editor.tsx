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
  ({ initialSvg, onChangeSvg$ }) => {
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

      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%");
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
      <div class="flex flex-col gap-3">
        {/* ── Full-width SVG canvas ─────────────────────────────── */}
        <div class="relative w-full overflow-hidden rounded-2xl border border-rose-100 bg-white">
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
          {/* SVG container — fills parent via absolute */}
          <div
            ref={containerRef}
            class="relative p-3"
            style={{ minHeight: "420px" }}
          />
        </div>

        {/* ── Colour control bar ─────────────────────────────────── */}
        <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/40 px-3 py-2">
          {/* Hint */}
          <p class="shrink-0 text-[11px] text-rose-400">
            {sel < 0 ? "👆 点击路径选择" : `路径 ${sel + 1} · ${selEntry?.tag}`}
          </p>

          {/* Path swatches — scrollable row */}
          <div class="flex flex-1 flex-wrap gap-1.5">
            {entries.value.map((e) => {
              const isSel = selectedIdx.value === e.idx;
              const displayColor = e.fill === "currentColor" ? "#111" : e.fill;
              return (
                <button
                  key={e.idx}
                  class={[
                    "flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all",
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

          {/* Colour picker for selected path */}
          {selEntry && (
            <div class="flex shrink-0 items-center gap-1.5">
              <input
                type="color"
                class="h-7 w-7 cursor-pointer rounded-lg border border-rose-200 p-0.5"
                value={selEntry.fill === "currentColor" ? "#111111" : selEntry.fill}
                onInput$={(e) =>
                  applyColor(
                    selEntry.idx,
                    (e.target as HTMLInputElement).value,
                  )
                }
              />
              <input
                type="text"
                class="w-24 rounded-xl border border-rose-100 bg-white px-2 py-1 font-mono text-xs text-rose-800 focus:border-rose-300 focus:outline-none"
                value={selEntry.fill}
                onBlur$={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (/^#[0-9a-fA-F]{3,8}$/.test(v) || v === "currentColor")
                    applyColor(selEntry.idx, v);
                }}
              />
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
