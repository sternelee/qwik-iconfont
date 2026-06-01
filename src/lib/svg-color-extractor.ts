/**
 * Color-aware SVG flattening — browser-side only (uses DOMParser + DOM APIs).
 *
 * Walks the SVG element tree, groups visible paths by their effective fill
 * colour, and returns layered data suitable for COLRv0 font generation.
 *
 * Supported fill sources (in priority order):
 *   1. element `fill` attribute
 *   2. element `style` attribute `fill:` property
 *   3. Inherited fill from the nearest ancestor
 *   4. Default: "currentColor"
 */

// ── Colour normalisation ────────────────────────────────────────────────────

/** Small lookup table for CSS named colours that appear in icon SVGs. */
const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  grey: "#808080",
  gray: "#808080",
  silver: "#c0c0c0",
  gold: "#ffd700",
  transparent: "none",
};

function hexByte(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/** Normalise any CSS colour string to lowercase `#rrggbb[aa]` or the
 *  sentinels "currentColor" / "none". */
export function normaliseColor(raw: string): string {
  const s = raw.trim().toLowerCase();

  if (!s || s === "none") return "none";
  if (s === "currentcolor") return "currentColor";

  // Named colour
  if (s in NAMED_COLORS) return NAMED_COLORS[s];

  // #rgb → #rrggbb
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  // #rrggbb / #rrggbbaa
  if (/^#[0-9a-f]{6,8}$/.test(s)) return s;

  // rgb(r,g,b) / rgba(r,g,b,a)
  const rgb = s.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/,
  );
  if (rgb) {
    const r = Math.round(parseFloat(rgb[1]));
    const g = Math.round(parseFloat(rgb[2]));
    const b = Math.round(parseFloat(rgb[3]));
    const a = rgb[4] !== undefined ? Math.round(parseFloat(rgb[4]) * 255) : 255;
    if (a === 255) return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
    return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${hexByte(a)}`;
  }

  // Fall back — return as-is
  return s;
}

// ── SVG transform helpers ───────────────────────────────────────────────────

function parseTransform(t: string): number[] {
  const m = [1, 0, 0, 1, 0, 0];
  const cmds = t.match(/(\w+)\s*\(([^)]+)\)/g);
  if (!cmds) return m;
  for (const cmd of cmds) {
    const match = cmd.match(/(\w+)\s*\(([^)]+)\)/);
    if (!match) continue;
    const [, name, argsStr] = match;
    const args = argsStr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (name === "matrix" && args.length === 6) return args;
    if (name === "translate") {
      m[4] = args[0] || 0;
      m[5] = args[1] || 0;
    } else if (name === "scale") {
      m[0] = args[0];
      m[3] = args[1] ?? args[0];
    } else if (name === "rotate") {
      const a = ((args[0] || 0) * Math.PI) / 180;
      const cos = Math.cos(a),
        sin = Math.sin(a);
      return [cos, sin, -sin, cos, 0, 0];
    }
  }
  return m;
}

function mulMatrix(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

// ── Shape → path data ───────────────────────────────────────────────────────

function shapeToPath(el: Element): string {
  const tag = el.tagName.toLowerCase().replace(/^.*:/, "");
  const a = (name: string, def = "0") => el.getAttribute(name) || def;
  const n = (name: string, def = 0) => parseFloat(a(name, String(def)));

  switch (tag) {
    case "path":
      return a("d", "");
    case "rect": {
      const x = n("x"),
        y = n("y"),
        w = n("width"),
        h = n("height");
      const rx = Math.min(n("rx"), w / 2),
        ry = Math.min(n("ry") || n("rx"), h / 2);
      if (rx || ry) {
        const r = Math.min(rx, ry);
        return (
          `M${x + r},${y}H${x + w - r}` +
          `Q${x + w},${y} ${x + w},${y + r}` +
          `V${y + h - r}` +
          `Q${x + w},${y + h} ${x + w - r},${y + h}` +
          `H${x + r}Q${x},${y + h} ${x},${y + h - r}` +
          `V${y + r}Q${x},${y} ${x + r},${y}Z`
        );
      }
      return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
    }
    case "circle": {
      const cx = n("cx"),
        cy = n("cy"),
        r = n("r");
      const k = r * 0.5523;
      return (
        `M${cx},${cy - r}` +
        `C${cx + k},${cy - r} ${cx + r},${cy - k} ${cx + r},${cy}` +
        `C${cx + r},${cy + k} ${cx + k},${cy + r} ${cx},${cy + r}` +
        `C${cx - k},${cy + r} ${cx - r},${cy + k} ${cx - r},${cy}` +
        `C${cx - r},${cy - k} ${cx - k},${cy - r} ${cx},${cy - r}Z`
      );
    }
    case "ellipse": {
      const cx = n("cx"),
        cy = n("cy"),
        rx = n("rx"),
        ry = n("ry");
      const kx = rx * 0.5523,
        ky = ry * 0.5523;
      return (
        `M${cx},${cy - ry}` +
        `C${cx + kx},${cy - ry} ${cx + rx},${cy - ky} ${cx + rx},${cy}` +
        `C${cx + rx},${cy + ky} ${cx + kx},${cy + ry} ${cx},${cy + ry}` +
        `C${cx - kx},${cy + ry} ${cx - rx},${cy + ky} ${cx - rx},${cy}` +
        `C${cx - rx},${cy - ky} ${cx - kx},${cy - ry} ${cx},${cy - ry}Z`
      );
    }
    case "line": {
      return `M${n("x1")},${n("y1")}L${n("x2")},${n("y2")}`;
    }
    case "polygon":
    case "polyline": {
      const pts = a("points", "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (pts.length < 4) return "";
      let d = `M${pts[0]},${pts[1]}`;
      for (let i = 2; i < pts.length - 1; i += 2) {
        d += `L${pts[i]},${pts[i + 1]}`;
      }
      if (tag === "polygon") d += "Z";
      return d;
    }
    default:
      return "";
  }
}

function applyMatrix(d: string, m: number[]): string {
  // Inline transform via scale+translate for simple cases;
  // for full correctness use svgpath (available in font-gen.ts).
  // Here we emit the path with a transform wrapper accepted by svgpath.
  // Caller is responsible for applying svgpath.transform().
  return d; // Return untransformed — caller uses matrix separately
}

// ── Fill resolution ─────────────────────────────────────────────────────────

function getStyleFill(el: Element): string | null {
  const style = el.getAttribute("style") || "";
  const match = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  return match ? match[1].trim() : null;
}

function resolveElementFill(el: Element, inherited: string): string {
  const attr = el.getAttribute("fill");
  const styleFill = getStyleFill(el);
  const raw = styleFill ?? attr ?? null;
  if (!raw || raw === "inherit") return inherited;
  return normaliseColor(raw);
}

// ── Main export ──────────────────────────────────────────────────────────────

export interface ColorLayer {
  /** Normalised hex colour, or "currentColor". */
  color: string;
  /** Combined SVG path `d` strings (un-transformed, in SVG viewport coords). */
  paths: string[];
  /** Accumulated transform matrix for each path (parallel array to paths). */
  matrices: number[][];
}

export interface SVGColorData {
  /** Layers in paint order (bottom → top). */
  layers: ColorLayer[];
  /** Unique palette (excludes "currentColor"). */
  palette: string[];
  viewBox: { minX: number; minY: number; width: number; height: number };
  /** True when there are 2+ distinct visible fill colours. */
  isMultiColor: boolean;
}

function parseViewBox(vb: string): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const p = vb
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return {
    minX: p[0] ?? 0,
    minY: p[1] ?? 0,
    width: p[2] ?? 1024,
    height: p[3] ?? 1024,
  };
}

/** Extract colour layers from an SVG string. Runs in browser (uses DOMParser). */
export function extractSVGColorLayers(svgContent: string): SVGColorData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svg = doc.querySelector("svg");

  const SKIP_TAGS = new Set([
    "defs",
    "clippath",
    "mask",
    "metadata",
    "title",
    "desc",
    "script",
    "style",
    "symbol",
    "lineargradient",
    "radialgradient",
    "pattern",
    "filter",
  ]);

  const viewBoxAttr =
    svg?.getAttribute("viewBox") ??
    svg?.getAttribute("viewbox") ??
    "0 0 1024 1024";
  const viewBox = parseViewBox(viewBoxAttr);

  // Map: normalised colour → {paths[], matrices[]}
  const layerMap = new Map<string, { paths: string[]; matrices: number[][] }>();

  function addPath(color: string, d: string, matrix: number[]) {
    if (!d) return;
    if (!layerMap.has(color)) layerMap.set(color, { paths: [], matrices: [] });
    layerMap.get(color)!.paths.push(d);
    layerMap.get(color)!.matrices.push(matrix);
  }

  function traverse(el: Element, parentMatrix: number[], parentFill: string) {
    const tag = el.tagName.toLowerCase().replace(/^.*:/, "");

    if (SKIP_TAGS.has(tag)) return;

    const display = el.getAttribute("display") ?? getStyleFill(el); // rough check
    if (el.getAttribute("display") === "none") return;
    if (el.getAttribute("visibility") === "hidden") return;

    const t = el.getAttribute("transform");
    const localM = t ? parseTransform(t) : [1, 0, 0, 1, 0, 0];
    const currentM = mulMatrix(parentMatrix, localM);

    const fill = resolveElementFill(el, parentFill);

    const SHAPE_TAGS = new Set([
      "path",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
    ]);

    if (SHAPE_TAGS.has(tag)) {
      if (fill !== "none") {
        const d = shapeToPath(el);
        if (d) addPath(fill, d, currentM);
      }
    }

    for (const child of el.children) {
      traverse(child, currentM, fill);
    }
  }

  if (svg) traverse(svg, [1, 0, 0, 1, 0, 0], "currentColor");

  // Build layer list (insertion order = paint order)
  const layers: ColorLayer[] = [];
  const palette: string[] = [];
  for (const [color, { paths, matrices }] of layerMap) {
    layers.push({ color, paths, matrices });
    if (color !== "currentColor") palette.push(color);
  }

  const colorCount = new Set(layers.map((l) => l.color)).size;

  return { layers, palette, viewBox, isMultiColor: colorCount > 1 };
}

/** Remove degenerate empty subpaths (M/m x y followed by M/m/L/etc with no drawing commands).
 *  Common in IconFont SVGs where M sets a reference point and m offsets from it. */
function removeDegenerateSubpaths(d: string): string {
  // Split into subpath segments: each starts with M or m
  const segments = d.match(/[Mm][^Mm]*(?:[zZ])?/g);
  if (!segments) return d;
  const valid = segments.filter((seg) => {
    // After the initial M/m + coordinates, check for drawing commands
    const afterMoveTo = seg.replace(/^[Mm][\d.\s,-]+/, "");
    return /[LlHhVvCcSsQqTtAaZz]/.test(afterMoveTo);
  });
  return valid.join("");
}

/**
 * Merge all paths of a colour layer into a single `d` string with
 * matrix transforms applied via svgpath.
 *
 * Returns null if svgpath is unavailable (server-side call).
 */
export async function mergeLayerPaths(
  layer: ColorLayer,
): Promise<string | null> {
  try {
    const svgpathMod = await import("svgpath");
    const svgpathFn = (svgpathMod as any).default ?? (svgpathMod as any);

    const parts: string[] = [];
    for (let i = 0; i < layer.paths.length; i++) {
      const m = layer.matrices[i];
      const [a, b, c, d, e, f] = m;
      const raw = svgpathFn(layer.paths[i])
        .unarc()
        .unshort()
        .abs()
        .transform(`matrix(${a},${b},${c},${d},${e},${f})`)
        .round(2)
        .toString();
      const cleaned = removeDegenerateSubpaths(raw);
      if (cleaned) parts.push(cleaned);
    }
    return parts.join(" ");
  } catch {
    return layer.paths.join(" ");
  }
}

/** Serialisable form stored in the DB. */
export interface StoredColorLayer {
  color: string; // "#rrggbb" | "currentColor"
  d: string; // merged path data (font-coordinate-space after transform)
}
