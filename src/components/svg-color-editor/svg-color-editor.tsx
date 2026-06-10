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

// ── Re-exported utilities ──────────────────────────────────────────────────────

/**
 * Normalize SVG: convert style-based fill/stroke to attribute-based so that
 * regex-based colour detection and replacement work correctly.
 *
 * Handles:
 *  1. Inline style="fill: red; stroke: blue" → fill="red" stroke="blue"
 *  2. CSS classes in <style> blocks — extracts fill/stroke values per class
 *     and applies them as attributes (best-effort, single-class per element).
 */
export function normalizeSvgStyleFills(svg: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const root = doc.querySelector("svg");
    if (!root) return svg;

    // Strip dangerous elements/attributes but keep <style>
    root.querySelectorAll("script, foreignObject").forEach((el) => el.remove());
    root.querySelectorAll("*").forEach((el) => {
      for (const a of Array.from(el.attributes)) {
        if (
          a.name.startsWith("on") ||
          a.value.toLowerCase().startsWith("javascript:")
        ) {
          el.removeAttribute(a.name);
        }
      }
    });

    // Extract fill/stroke from <style> rules (simple class selectors only)
    const styleEl = root.querySelector("style");
    const classColorMap: Record<string, { fill?: string; stroke?: string }> = {};
    if (styleEl) {
      const cssText = styleEl.textContent || "";
      const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
      let ruleMatch: RegExpExecArray | null;
      while ((ruleMatch = ruleRe.exec(cssText))) {
        const cls = ruleMatch[1];
        const body = ruleMatch[2];
        const fillMatch = body.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
        const strokeMatch = body.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);
        if (fillMatch || strokeMatch) {
          classColorMap[cls] = {};
          if (fillMatch) classColorMap[cls].fill = fillMatch[1].trim();
          if (strokeMatch) classColorMap[cls].stroke = strokeMatch[1].trim();
        }
      }
      // Remove fill/stroke rules from <style> so they don't override attribute-based fills
      let cleanedCss = cssText;
      for (const cls of Object.keys(classColorMap)) {
        cleanedCss = cleanedCss.replace(
          new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`, "g"),
          (match) => {
            const remaining = match
              .replace(/(?:^|;)\s*fill\s*:[^;]*/gi, "")
              .replace(/(?:^|;)\s*stroke\s*:[^;]*/gi, "")
              .replace(/\{;+/g, "{")
              .replace(/;+\}/g, "}")
              .replace(/\{\s*\}/g, "");
            return remaining;
          },
        );
      }
      styleEl.textContent = cleanedCss;
    }

    const shapes = root.querySelectorAll(
      "path, rect, circle, ellipse, line, polyline, polygon, g, use, text",
    );
    shapes.forEach((el) => {
      // 1. Inline style → attribute
      const style = el.getAttribute("style") || "";
      const styleFill = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
      const styleStroke = style.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);
      if (styleFill) {
        const val = styleFill[1].trim();
        if (!el.getAttribute("fill")) el.setAttribute("fill", val);
      }
      if (styleStroke) {
        const val = styleStroke[1].trim();
        if (!el.getAttribute("stroke")) el.setAttribute("stroke", val);
      }
      // Clean style attr after extracting
      if (styleFill || styleStroke) {
        const cleaned = style
          .replace(/(?:^|;)\s*fill\s*:[^;]*/gi, "")
          .replace(/(?:^|;)\s*stroke\s*:[^;]*/gi, "")
          .replace(/^;+|;+$/g, "")
          .trim();
        if (cleaned) el.setAttribute("style", cleaned);
        else el.removeAttribute("style");
      }

      // 2. CSS class → attribute (first class that has colours)
      const classAttr = el.getAttribute("class") || "";
      const classes = classAttr.split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        if (classColorMap[cls]) {
          if (classColorMap[cls].fill && !el.getAttribute("fill"))
            el.setAttribute("fill", classColorMap[cls].fill!);
          if (classColorMap[cls].stroke && !el.getAttribute("stroke"))
            el.setAttribute("stroke", classColorMap[cls].stroke!);
        }
      }
    });

    return new XMLSerializer().serializeToString(root);
  } catch {
    return svg;
  }
}

export function svgHasMultipleColors(svg: string): boolean {
  // First normalize so style-based and class-based fills become attributes
  const normalized = normalizeSvgStyleFills(svg);
  const seen = new Set<string>();
  for (const m of normalized.matchAll(/\bfill="([^"]+)"/gi)) {
    const f = m[1].toLowerCase().trim();
    if (f !== "none" && f !== "currentcolor") seen.add(f);
    if (seen.size > 1) return true;
  }
  return false;
}
