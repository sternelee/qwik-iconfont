/**
 * SvgColorCanvas — interactive path-level colour editor (canvas only).
 *
 * Renders the SVG in a 300×300 box and wires click/hover events to each
 * drawable path. State is shared with the parent via a `ColorEditorStore`
 * Qwik store so the colour controls can live in col 3 of the editor grid.
 *
 * Communication flow:
 *   canvas click → store.selectedIdx
 *   parent picker → store.pendingColorChange → canvas applies to DOM → store.pendingSvg
 *   parent useTask$ → svgContent.value = store.pendingSvg
 */
import { component$, useSignal, useTask$ } from "@builder.io/qwik";

// ── Shared state interface ────────────────────────────────────────────────────

export interface ColorPathEntry {
  idx: number;
  tag: string;
  fill: string;
}

export interface ColorEditorStore {
  selectedIdx: number;
  entries: ColorPathEntry[];
  pendingSvg: string;
  /** Set by the parent colour picker; canvas watches and applies to DOM. */
  pendingColorChange: { idx: number; color: string } | null;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

const SHAPE_SEL = "path, rect, circle, ellipse, line, polyline, polygon, use";

function parseSanitisedSvg(raw: string): SVGSVGElement | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;
    svg.querySelectorAll("script, foreignObject").forEach((el) => el.remove());
    svg.querySelectorAll("*").forEach((el) => {
      for (const a of Array.from(el.attributes)) {
        if (
          a.name.startsWith("on") ||
          a.value.toLowerCase().startsWith("javascript:")
        )
          el.removeAttribute(a.name);
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

function getElementFill(el: Element): string {
  const style = el.getAttribute("style") || "";
  const m = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  if (m) return m[1].trim();
  return el.getAttribute("fill") || "currentColor";
}

export function setElementFill(el: Element, color: string) {
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

// ── Component ─────────────────────────────────────────────────────────────────

export interface SvgColorCanvasProps {
  /** SVG content — read once on mount. */
  svgContent: string;
  /** Shared reactive store. */
  store: ColorEditorStore;
}

export const SvgColorCanvas = component$<SvgColorCanvasProps>(
  ({ svgContent, store }) => {
    const containerRef = useSignal<Element>();

    // ── Phase 1: mount + wire events ──────────────────────────────
    useTask$(() => {
      if (typeof window === "undefined") return;
      const container = containerRef.value;
      if (!container) return;

      const svgEl = parseSanitisedSvg(svgContent);
      if (!svgEl) return;

      svgEl.removeAttribute("width");
      svgEl.removeAttribute("height");
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%");
      svgEl.style.display = "block";
      container.appendChild(document.adoptNode(svgEl));

      const svg = container.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;

      const shapes = Array.from(svg.querySelectorAll(SHAPE_SEL)) as Element[];
      const entries: ColorPathEntry[] = [];

      shapes.forEach((el, i) => {
        const fill = getElementFill(el);
        if (fill === "none") return;
        entries.push({ idx: i, tag: el.tagName.toLowerCase(), fill });
        (el as HTMLElement).style.cursor = "pointer";
        (el as HTMLElement).style.transition = "opacity 0.1s, filter 0.1s";

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          store.selectedIdx = i;
        });
        el.addEventListener("mouseenter", () => {
          if (store.selectedIdx !== i)
            (el as HTMLElement).style.opacity = "0.72";
        });
        el.addEventListener("mouseleave", () => {
          (el as HTMLElement).style.opacity = "";
        });
      });

      store.entries = entries;
    });

    // ── Phase 2: highlight selected path ─────────────────────────
    useTask$(({ track }) => {
      if (typeof window === "undefined") return;
      const sel = track(() => store.selectedIdx);
      const svg = containerRef.value?.querySelector("svg");
      if (!svg) return;
      Array.from(svg.querySelectorAll(SHAPE_SEL)).forEach((el, i) => {
        (el as SVGElement).style.filter = i === sel ? SEL_FILTER : "";
        if (i !== sel) (el as HTMLElement).style.opacity = "";
      });
    });

    // ── Phase 3: apply colour changes from col-3 picker ───────────
    useTask$(({ track }) => {
      if (typeof window === "undefined") return;
      const change = track(() => store.pendingColorChange);
      if (!change) return;
      const svg = containerRef.value?.querySelector("svg");
      if (!svg) return;
      const el = Array.from(svg.querySelectorAll(SHAPE_SEL))[change.idx] as
        | Element
        | undefined;
      if (el) {
        setElementFill(el, change.color);
        store.entries = store.entries.map((e) =>
          e.idx === change.idx ? { ...e, fill: change.color } : e,
        );
        store.pendingSvg = serialiseSvg(svg);
      }
      store.pendingColorChange = null;
    });

    // ── Render: 300×300 canvas cell ────────────────────────────────
    return (
      <div
        class="relative overflow-hidden rounded-xl"
        style={{
          width: "300px",
          height: "300px",
          backgroundImage:
            "linear-gradient(45deg,#f3f4f6 25%,transparent 25%)," +
            "linear-gradient(-45deg,#f3f4f6 25%,transparent 25%)," +
            "linear-gradient(45deg,transparent 75%,#f3f4f6 75%)," +
            "linear-gradient(-45deg,transparent 75%,#f3f4f6 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
          backgroundColor: "#fff",
        }}
      >
        <div ref={containerRef} class="absolute inset-0 p-2" />
      </div>
    );
  },
);

// ── Re-exported utility ───────────────────────────────────────────────────────

export function svgHasMultipleColors(svg: string): boolean {
  const seen = new Set<string>();
  for (const m of svg.matchAll(/\bfill="([^"]+)"/gi)) {
    const f = m[1].toLowerCase().trim();
    if (f !== "none" && f !== "currentcolor") seen.add(f);
    if (seen.size > 1) return true;
  }
  return false;
}
