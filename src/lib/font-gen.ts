// Font generation using svg2ttf pipeline (same approach as fontello.com).
// SVG icons → extracted path data → SVG font XML → svg2ttf → TTF buffer.
//
// This replaces the previous opentype.js direct-font-building approach which
// was fragile (Path.prototype.transform removed in opentype 2.x, quadratic
// bezier requirement not handled, TTF table generation unreliable).

import svg2ttf from "svg2ttf";
import svgpathFn from "svgpath";
import type { Icon } from "./types";

// ---------------------------------------------------------------------------
// SVG transform matrix helpers (used by flattenSVG to handle <g transform="...">)
// ---------------------------------------------------------------------------

/** Parse SVG transform attribute into a 2x3 matrix [a,b,c,d,e,f] */
function parseTransform(transform: string): number[] {
  const matrix = [1, 0, 0, 1, 0, 0];
  if (!transform) return matrix;

  const cmds = transform.match(/(\w+)\s*\(([^)]+)\)/g);
  if (!cmds) return matrix;

  for (const cmd of cmds) {
    const match = cmd.match(/(\w+)\s*\(([^)]+)\)/);
    if (!match) continue;
    const [, name, argsStr] = match;
    const args = argsStr
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    let m = [1, 0, 0, 1, 0, 0];
    switch (name.toLowerCase()) {
      case "translate":
        m = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
        break;
      case "scale": {
        const sx = args[0] || 1;
        const sy = args[1] ?? sx;
        m = [sx, 0, 0, sy, 0, 0];
        break;
      }
      case "rotate": {
        const angle = ((args[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        m = [cos, sin, -sin, cos, 0, 0];
        break;
      }
      case "matrix":
        if (args.length >= 6) {
          m = [args[0], args[1], args[2], args[3], args[4], args[5]];
        }
        break;
    }
    // Multiply current matrix * new matrix
    const [a1, b1, c1, d1, e1, f1] = matrix;
    const [a2, b2, c2, d2, e2, f2] = m;
    matrix[0] = a1 * a2 + c1 * b2;
    matrix[1] = b1 * a2 + d1 * b2;
    matrix[2] = a1 * c2 + c1 * d2;
    matrix[3] = b1 * c2 + d1 * d2;
    matrix[4] = a1 * e2 + c1 * f2 + e1;
    matrix[5] = b1 * e2 + d1 * f2 + f1;
  }

  return matrix;
}

/** Multiply two 2x3 matrices: result = a * b */
function multiplyMatrix(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

// ---------------------------------------------------------------------------
// Path data helpers
// ---------------------------------------------------------------------------

/** Sanitize path data for compatibility.
 *  - `.5` → `0.5` (leading-dot numbers)
 *  - `0.5.5` → `0.5 0.5` (double-dot clusters)
 *  - `123.` → `123` (trailing dots)
 *  - `-0.000` → `0`
 *  - Normalise whitespace
 */
function sanitizePathData(pathData: string): string {
  let result = pathData
    .replace(/([^\d])\.(\d)/g, "$10.$2")
    .replace(/(^|\s)\.(\d)/g, "$10.$2");

  // Loop until all double-dot clusters are resolved.
  const doubleDotRe = /(\d\.\d+)\.(?=\d)/g;
  let prev = "";
  for (let i = 0; i < 10 && prev !== result; i++) {
    prev = result;
    result = result.replace(doubleDotRe, "$1 0.");
  }

  return result
    .replace(/(\d+)\.(?=\s|$)/g, "$1")
    .replace(/-0\.0+\b/g, "0")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// SVG shape → path data conversion (handles <rect>, <circle>, <ellipse>, etc.)
// ---------------------------------------------------------------------------

function shapeToPath(el: Element): string {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "path":
      return el.getAttribute("d") || "";
    case "circle": {
      const cx = parseFloat(el.getAttribute("cx") || "0");
      const cy = parseFloat(el.getAttribute("cy") || "0");
      const r = parseFloat(el.getAttribute("r") || "0");
      if (!r) return "";
      const k = 0.5522847498; // cubic bezier approximation of quarter circle
      const kr = k * r;
      return [
        `M ${cx - r} ${cy}`,
        `C ${cx - r} ${cy - kr} ${cx - kr} ${cy - r} ${cx} ${cy - r}`,
        `C ${cx + kr} ${cy - r} ${cx + r} ${cy - kr} ${cx + r} ${cy}`,
        `C ${cx + r} ${cy + kr} ${cx + kr} ${cy + r} ${cx} ${cy + r}`,
        `C ${cx - kr} ${cy + r} ${cx - r} ${cy + kr} ${cx - r} ${cy}`,
        "Z",
      ].join(" ");
    }
    case "rect": {
      const x = parseFloat(el.getAttribute("x") || "0");
      const y = parseFloat(el.getAttribute("y") || "0");
      const w = parseFloat(el.getAttribute("width") || "0");
      const h = parseFloat(el.getAttribute("height") || "0");
      const rx = parseFloat(el.getAttribute("rx") || "0");
      const ry = parseFloat(el.getAttribute("ry") || "0") || rx;
      if (!w || !h) return "";
      if (rx || ry) {
        const rrx = rx || ry;
        const rry = ry || rx;
        if (Math.abs(rrx - rry) < 0.001) {
          const r = rrx;
          const k = 0.5522847498;
          const kr = k * r;
          return [
            `M ${x + r} ${y}`,
            `H ${x + w - r}`,
            `C ${x + w - r + kr} ${y} ${x + w} ${y + r - kr} ${x + w} ${y + r}`,
            `V ${y + h - r}`,
            `C ${x + w} ${y + h - r + kr} ${x + w - r + kr} ${y + h} ${x + w - r} ${y + h}`,
            `H ${x + r}`,
            `C ${x + r - kr} ${y + h} ${x} ${y + h - r + kr} ${x} ${y + h - r}`,
            `V ${y + r}`,
            `C ${x} ${y + r - kr} ${x + r - kr} ${y} ${x + r} ${y}`,
            "Z",
          ].join(" ");
        }
        return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
      }
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    }
    case "ellipse": {
      const cx = parseFloat(el.getAttribute("cx") || "0");
      const cy = parseFloat(el.getAttribute("cy") || "0");
      const rx = parseFloat(el.getAttribute("rx") || "0");
      const ry = parseFloat(el.getAttribute("ry") || "0");
      if (!rx || !ry) return "";
      const k = 0.5522847498;
      const krx = k * rx;
      const kry = k * ry;
      return [
        `M ${cx - rx} ${cy}`,
        `C ${cx - rx} ${cy - kry} ${cx - krx} ${cy - ry} ${cx} ${cy - ry}`,
        `C ${cx + krx} ${cy - ry} ${cx + rx} ${cy - kry} ${cx + rx} ${cy}`,
        `C ${cx + rx} ${cy + kry} ${cx + krx} ${cy + ry} ${cx} ${cy + ry}`,
        `C ${cx - krx} ${cy + ry} ${cx - rx} ${cy + kry} ${cx - rx} ${cy}`,
        "Z",
      ].join(" ");
    }
    case "line": {
      const x1 = parseFloat(el.getAttribute("x1") || "0");
      const y1 = parseFloat(el.getAttribute("y1") || "0");
      const x2 = parseFloat(el.getAttribute("x2") || "0");
      const y2 = parseFloat(el.getAttribute("y2") || "0");
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    case "polyline":
    case "polygon": {
      const points = el.getAttribute("points") || "";
      const nums = points
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      if (nums.length < 4) return "";
      const cmds: string[] = [`M ${nums[0]} ${nums[1]}`];
      for (let i = 2; i < nums.length; i += 2) {
        cmds.push(`L ${nums[i]} ${nums[i + 1]}`);
      }
      if (tag === "polygon") cmds.push("Z");
      return cmds.join(" ");
    }
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// SVG flattening — walk SVG DOM, collect path data, apply transforms
// ---------------------------------------------------------------------------

function transformPathData(pathData: string, matrix: number[]): string {
  if (
    !matrix ||
    (matrix[0] === 1 &&
      matrix[1] === 0 &&
      matrix[2] === 0 &&
      matrix[3] === 1 &&
      matrix[4] === 0 &&
      matrix[5] === 0)
  ) {
    return pathData;
  }
  try {
    return svgpathFn(pathData)
      .unarc()
      .transform(`matrix(${matrix.join(" ")})`)
      .round(2)
      .toString();
  } catch {
    return pathData;
  }
}

function flattenSVG(svg: SVGElement): { d: string; viewBox: string } | null {
  const viewBox =
    svg.getAttribute("viewBox") ||
    svg.getAttribute("viewbox") ||
    "0 0 1024 1024";
  const parts: string[] = [];

  const traverse = (el: Element, parentMatrix: number[]) => {
    const tag = el.tagName.toLowerCase();

    // Skip invisible elements
    const display = el.getAttribute("display");
    if (display === "none") return;

    // Skip defs/clipPath/mask (referenced, not rendered directly)
    if (
      [
        "defs",
        "clippath",
        "mask",
        "metadata",
        "title",
        "desc",
        "script",
        "style",
      ].includes(tag)
    ) {
      return;
    }

    const transform = el.getAttribute("transform");
    const localMatrix = transform
      ? parseTransform(transform)
      : [1, 0, 0, 1, 0, 0];
    const currentMatrix = multiplyMatrix(parentMatrix, localMatrix);

    if (
      [
        "path",
        "circle",
        "rect",
        "ellipse",
        "line",
        "polyline",
        "polygon",
      ].includes(tag)
    ) {
      const pd = shapeToPath(el);
      if (pd) {
        const transformed = transformPathData(pd, currentMatrix);
        if (transformed) parts.push(transformed);
      }
    }

    for (const child of Array.from(el.children)) {
      traverse(child, currentMatrix);
    }
  };

  traverse(svg, [1, 0, 0, 1, 0, 0]);

  if (parts.length === 0) return null;
  return { d: parts.join(" "), viewBox };
}

export function extractSVGPath(
  svgContent: string,
): { d: string; viewBox: string } | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;
  return flattenSVG(svg as SVGElement);
}

function parseViewBox(viewBox: string): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  return {
    minX: parts[0] || 0,
    minY: parts[1] || 0,
    width: parts[2] || 1024,
    height: parts[3] || 1024,
  };
}

// ---------------------------------------------------------------------------
// TTF font generation — SVG font XML → svg2ttf → TTF ArrayBuffer
// ---------------------------------------------------------------------------

/**
 * Generate a TrueType Font (TTF) from a list of icons.
 *
 * Pipeline (same approach as fontello.com):
 *   1. Extract path data from each SVG icon (flatten shapes, apply transforms).
 *   2. Scale & flip paths to font coordinate space (svgpath).
 *   3. Assemble an SVG font XML string.
 *   4. Convert SVG font → TTF via svg2ttf.
 */
export async function generateTTFFont(
  fontFamily: string,
  icons: Icon[],
  prefix: string,
): Promise<ArrayBuffer | null> {
  const ascent = 850;
  const descent = -150;
  const unitsPerEm = 1000;

  const glyphLines: string[] = [];
  let charCode = 0xe000;

  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    const content = icon.content || "";
    const extracted = extractSVGPath(content);
    if (!extracted) continue;

    const { d, viewBox } = extracted;
    const vb = parseViewBox(viewBox);

    // Scale to font units
    const scale = unitsPerEm / Math.max(vb.width, vb.height);

    // Transform path to font coordinate space:
    //   - scale x/y to fill unitsPerEm
    //   - flip Y (SVG Y-down → font Y-up)
    //   - map SVG origin to font baseline
    const rawPath = sanitizePathData(d);
    let transformed: string;
    try {
      transformed = svgpathFn(rawPath)
        .unarc()
        .unshort()
        .abs()
        .scale(scale, -scale)
        .translate(-vb.minX * scale, ascent + vb.minY * scale)
        .round(0)
        .rel()
        .toString();
    } catch {
      console.warn(`Failed to transform path for icon ${icon.name}`);
      continue;
    }

    const unicode = icon.unicode
      ? parseInt(
          icon.unicode.replace(/^&#x?|^\\|^U\+/i, "").replace(/;$/, ""),
          16,
        )
      : charCode;

    glyphLines.push(
      `<glyph glyph-name="${prefix}${icon.name}" unicode="&#x${unicode.toString(16)};" d="${transformed}" horiz-adv-x="${unitsPerEm}" />`,
    );

    if (!icon.unicode) charCode++;
  }

  if (glyphLines.length === 0) return null;

  const svgFont = [
    `<?xml version="1.0" standalone="no"?>`,
    `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`,
    `<svg xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<font id="${fontFamily}" horiz-adv-x="${unitsPerEm}">`,
    `<font-face font-family="${fontFamily}" font-weight="400" units-per-em="${unitsPerEm}" ascent="${ascent}" descent="${descent}" />`,
    `<missing-glyph horiz-adv-x="${unitsPerEm}" />`,
    ...glyphLines,
    `</font>`,
    `</defs>`,
    `</svg>`,
  ].join("\n");

  try {
    const ttf = svg2ttf(svgFont, {});
    // ttf.buffer is Uint8Array; extract a clean ArrayBuffer copy
    return (ttf.buffer.buffer as ArrayBuffer).slice(
      ttf.buffer.byteOffset,
      ttf.buffer.byteOffset + ttf.buffer.byteLength,
    );
  } catch (e: any) {
    console.error("svg2ttf conversion failed:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Unified font generator — auto-detects coloured icons
// ---------------------------------------------------------------------------

/**
 * Generate a TTF (monochrome) or COLRv0 TTF (coloured) font automatically.
 * Use this instead of calling generateTTFFont directly.
 */
export async function generateFont(
  fontFamily: string,
  icons: Icon[],
  prefix: string,
): Promise<ArrayBuffer | null> {
  const hasColor = icons.some((ic) => ic.color_layers);
  if (hasColor) {
    const { generateCOLRFont } = await import("~/lib/colr-font-gen");
    const withLayers = icons.map((ic) => ({
      ...ic,
      parsedColorLayers: ic.color_layers
        ? (() => {
            try {
              return JSON.parse(ic.color_layers!);
            } catch {
              return undefined;
            }
          })()
        : undefined,
    }));
    return generateCOLRFont(fontFamily, withLayers, prefix);
  }
  return generateTTFFont(fontFamily, icons, prefix);
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

export function generateCSS(
  fontFamily: string,
  prefix: string,
  icons: Icon[],
): string {
  const rules = icons
    .map((icon, i) => {
      const unicode = icon.unicode || `\\${(0xe000 + i).toString(16)}`;
      return `.${prefix}${icon.name}:before { content: "${unicode}"; }`;
    })
    .join("\n  ");

  return `@font-face {
  font-family: "${fontFamily}";
  src: url("./${fontFamily}.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
}

.${prefix} {
  font-family: "${fontFamily}" !important;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

${rules}`;
}

/** Extract inner SVG content reliably using DOMParser */
function extractInnerSVG(content: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return content;
  return Array.from(svg.childNodes)
    .map((n) => {
      if (n.nodeType === Node.ELEMENT_NODE) return (n as Element).outerHTML;
      if (n.nodeType === Node.TEXT_NODE) return n.textContent;
      return "";
    })
    .filter(Boolean)
    .join("");
}

export function generateSymbolSVG(icons: Icon[], prefix: string): string {
  const symbols = icons
    .map((icon) => {
      const content = icon.content || "";
      const viewBox = icon.view_box || "0 0 1024 1024";
      const inner = extractInnerSVG(content);
      return `  <symbol id="${prefix}${icon.name}" viewBox="${viewBox}">${inner}</symbol>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true">\n  <defs>\n${symbols}\n  </defs>\n</svg>`;
}

export async function generateDemoHTML(
  fontFamily: string,
  prefix: string,
  icons: Icon[],
): Promise<string> {
  const css = generateCSS(fontFamily, prefix, icons);
  let fontBase64 = "";
  try {
    const { generateTTFFont } = await import("~/lib/font-gen");
    const ttf = await generateTTFFont(fontFamily, icons, prefix);
    if (ttf) {
      const bytes = new Uint8Array(ttf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontBase64 = btoa(binary);
    }
  } catch {
    // ignore font embedding failure
  }

  const inlineFontFace = fontBase64
    ? `@font-face {
  font-family: "${fontFamily}";
  src: url("data:font/truetype;charset=utf-8;base64,${fontBase64}") format("truetype");
  font-weight: normal;
  font-style: normal;
}`
    : (css.match(/@font-face\s*\{[^}]+\}/s)?.[0] ?? "");

  const items = icons
    .map((icon, i) => {
      const unicode = icon.unicode || `&#x${(0xe000 + i).toString(16)};`;
      return `    <li class="icon-item">\n      <i class="${prefix} ${prefix}${icon.name}"></i>\n      <div class="name">${icon.name}</div>\n      <div class="code">${unicode}</div>\n    </li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${fontFamily} - Icon Demo</title>\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px 20px; background: #f5f5f5; }\n    h1 { text-align: center; margin-bottom: 40px; font-size: 24px; }\n    .icon-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 20px; list-style: none; padding: 0; max-width: 1200px; margin: 0 auto; }\n    .icon-item { background: #fff; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s; }\n    .icon-item:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }\n    .icon-item i { font-size: 32px; color: #333; display: block; margin-bottom: 8px; }\n    .icon-item .name { font-size: 12px; color: #666; margin-bottom: 4px; word-break: break-all; }\n    .icon-item .code { font-size: 11px; color: #999; font-family: monospace; }\n    .icon-item .copy-btn { margin-top: 8px; padding: 2px 8px; font-size: 11px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; }\n    .icon-item .copy-btn:hover { background: #f0f0f0; }\n    .copy-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(100px); background: #333; color: #fff; padding: 8px 16px; border-radius: 6px; font-size: 13px; opacity: 0; transition: all 0.3s; pointer-events: none; }\n    .copy-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }\n    @media (max-width: 480px) { .icon-list { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 12px; } .icon-item { padding: 12px; } .icon-item i { font-size: 24px; } }\n${inlineFontFace ? "    " + inlineFontFace.replace(/\n/g, "\n    ") : ""}\n    .${prefix} { font-family: "${fontFamily}" !important; font-style: normal; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }\n    ${icons
    .map((icon, i) => {
      const unicode = icon.unicode || `\\${(0xe000 + i).toString(16)}`;
      return `.${prefix}${icon.name}:before { content: "${unicode}"; }`;
    })
    .join(
      "\n    ",
    )}\n  </style>\n</head>\n<body>\n  <h1>${fontFamily} - ${icons.length} Icons</h1>\n  <ul class="icon-list">\n${items}\n  </ul>\n  <div class="copy-toast" id="toast">已复制到剪贴板</div>\n  <script>\n    document.querySelectorAll('.icon-item i').forEach(function(el) {\n      el.style.cursor = 'pointer';\n      el.title = '点击复制 class 名';\n      el.addEventListener('click', function() {\n        var cls = this.className.split(' ').pop();\n        navigator.clipboard.writeText('<i class="${prefix} ' + cls + '"></i>').then(function() {\n          var toast = document.getElementById('toast');\n          toast.classList.add('show');\n          setTimeout(function() { toast.classList.remove('show'); }, 1500);\n        });\n      });\n    });\n  </script>\n</body>\n</html>`;
}
