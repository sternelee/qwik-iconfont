import type { Icon } from "./types";

let opentypeModule: any = null;

async function loadOpentype() {
  if (!opentypeModule) {
    opentypeModule = await import("opentype.js");
  }
  return opentypeModule;
}

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
    const args = argsStr.trim().split(/[\s,]+/).map(Number);

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

/** Extract all numbers from an SVG path command token using regex.
 *  SVG numbers can be separated by whitespace, comma, or nothing (if signed).
 */
function extractNumbers(tok: string): number[] {
  const numRe = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;
  return tok.match(numRe)?.map(Number) ?? [];
}

/** Sanitize path data for opentype.js compatibility.
 *  - Replace `.5` with `0.5` (opentype.js may not accept leading-dot numbers)
 *  - Replace `-0.000` with `0.000` to avoid parser issues
 *  - Ensure single spaces between commands and values
 */
function sanitizePathData(pathData: string): string {
  return pathData
    .replace(/([^\d])\.(\d)/g, "$10.$2")
    .replace(/(^|\s)\.(\d)/g, "$10.$2")
    .replace(/-0\.0+\b/g, "0")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert SVG elliptical arc (A/a) commands to cubic Bézier (C) curves.
 *  opentype.js does not support the A command; this approximates arcs
 *  by splitting them into <= 90° segments and fitting cubic Beziers.
 */
function arcsToCubics(pathData: string): string {
  const tokens = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!tokens) return pathData;

  const out: string[] = [];
  let cx = 0, cy = 0; // current point
  let sx = 0, sy = 0; // subpath start point

  for (const tok of tokens) {
    const cmd = tok[0];
    const nums = extractNumbers(tok);

    if (cmd === 'A' || cmd === 'a') {
      const isRel = cmd === 'a';
      for (let i = 0; i < nums.length; i += 7) {
        if (i + 6 >= nums.length) break; // incomplete arc params
        let rx = Math.abs(nums[i]);
        let ry = Math.abs(nums[i + 1]);
        const phi = (nums[i + 2] * Math.PI) / 180;
        const largeArc = nums[i + 3] !== 0;
        const sweep = nums[i + 4] !== 0;
        let x2 = nums[i + 5];
        let y2 = nums[i + 6];
        if (isRel) { x2 += cx; y2 += cy; }

        if (rx === 0 || ry === 0 || (cx === x2 && cy === y2)) {
          out.push(`L ${fmt(x2)} ${fmt(y2)}`);
          cx = x2; cy = y2;
          continue;
        }

        const x1 = cx, y1 = cy;
        const cosP = Math.cos(phi), sinP = Math.sin(phi);

        // Transform to ellipse-centered coordinates
        const dx = (x1 - x2) / 2;
        const dy = (y1 - y2) / 2;
        const x1_ = cosP * dx + sinP * dy;
        const y1_ = -sinP * dx + cosP * dy;

        // Ensure radii are large enough
        const check = (x1_ * x1_) / (rx * rx) + (y1_ * y1_) / (ry * ry);
        if (check > 1) {
          const scale = Math.sqrt(check);
          rx *= scale;
          ry *= scale;
        }

        // Compute center in transformed space
        const sq = Math.max(0,
          ((rx * rx * ry * ry) - (rx * rx * y1_ * y1_) - (ry * ry * x1_ * x1_)) /
          ((rx * rx * y1_ * y1_) + (ry * ry * x1_ * x1_))
        );
        const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(sq);
        const cx_ = coef * (rx * y1_) / ry;
        const cy_ = coef * -(ry * x1_) / rx;

        // Center in original space
        const cX = cosP * cx_ - sinP * cy_ + (x1 + x2) / 2;
        const cY = sinP * cx_ + cosP * cy_ + (y1 + y2) / 2;

        // Start and end angles on unit circle in transformed space
        let theta1 = Math.atan2((y1_ - cy_) / ry, (x1_ - cx_) / rx);
        let theta2 = Math.atan2((-y1_ - cy_) / ry, (-x1_ - cx_) / rx);

        let delta = theta2 - theta1;
        if (sweep && delta < 0) delta += 2 * Math.PI;
        if (!sweep && delta > 0) delta -= 2 * Math.PI;

        // Split into <= 90° segments
        const segments = Math.ceil(Math.abs(delta) / (Math.PI / 2));
        const step = delta / segments;

        for (let s = 0; s < segments; s++) {
          const a1 = theta1 + s * step;
          const a2 = a1 + step;
          const k = (4 / 3) * Math.tan(Math.abs(step) / 4);

          const u1 = Math.cos(a1), v1 = Math.sin(a1);
          const u2 = Math.cos(a2), v2 = Math.sin(a2);

          // Control points on unit circle
          const pu1 = u1 - k * v1, pv1 = v1 + k * u1;
          const pu2 = u2 + k * v2, pv2 = v2 - k * u2;

          // Map from unit circle to ellipse space
          const cp1x = cX + rx * pu1 * cosP - ry * pv1 * sinP;
          const cp1y = cY + rx * pu1 * sinP + ry * pv1 * cosP;
          const cp2x = cX + rx * pu2 * cosP - ry * pv2 * sinP;
          const cp2y = cY + rx * pu2 * sinP + ry * pv2 * cosP;
          const ex = cX + rx * u2 * cosP - ry * v2 * sinP;
          const ey = cY + rx * u2 * sinP + ry * v2 * cosP;

          out.push(`C ${fmt(cp1x)} ${fmt(cp1y)} ${fmt(cp2x)} ${fmt(cp2y)} ${fmt(ex)} ${fmt(ey)}`);
        }
        cx = x2; cy = y2;
      }
      continue;
    }

    // Pass through non-arc commands and track current point
    out.push(tok.trim());

    if (cmd === 'M') {
      if (nums.length >= 2) { cx = nums[nums.length - 2]; cy = nums[nums.length - 1]; sx = cx; sy = cy; }
    } else if (cmd === 'm') {
      if (nums.length >= 2) { cx += nums[nums.length - 2]; cy += nums[nums.length - 1]; sx = cx; sy = cy; }
    } else if (cmd === 'L' || cmd === 'T') {
      if (nums.length >= 2) { cx = nums[nums.length - 2]; cy = nums[nums.length - 1]; }
    } else if (cmd === 'l' || cmd === 't') {
      if (nums.length >= 2) { cx += nums[nums.length - 2]; cy += nums[nums.length - 1]; }
    } else if (cmd === 'H') {
      if (nums.length >= 1) cx = nums[nums.length - 1];
    } else if (cmd === 'h') {
      if (nums.length >= 1) cx += nums[nums.length - 1];
    } else if (cmd === 'V') {
      if (nums.length >= 1) cy = nums[nums.length - 1];
    } else if (cmd === 'v') {
      if (nums.length >= 1) cy += nums[nums.length - 1];
    } else if (cmd === 'C') {
      if (nums.length >= 2) { cx = nums[nums.length - 2]; cy = nums[nums.length - 1]; }
    } else if (cmd === 'c') {
      if (nums.length >= 2) { cx += nums[nums.length - 2]; cy += nums[nums.length - 1]; }
    } else if (cmd === 'S' || cmd === 'Q') {
      if (nums.length >= 2) { cx = nums[nums.length - 2]; cy = nums[nums.length - 1]; }
    } else if (cmd === 's' || cmd === 'q') {
      if (nums.length >= 2) { cx += nums[nums.length - 2]; cy += nums[nums.length - 1]; }
    } else if (cmd === 'Z' || cmd === 'z') {
      cx = sx; cy = sy;
    }
  }

  return sanitizePathData(out.join(' '));
}

/** Format a number for SVG path data: 3 decimal places, no trailing zeros. */
function fmt(n: number): string {
  if (!isFinite(n)) return "0";
  const s = n.toFixed(3);
  // Remove trailing zeros and possible trailing dot
  return s.replace(/\.?0+$/, "");
}

/** Apply 2x3 matrix to a path data string by transforming the path via opentype.js */
function transformPathData(pathData: string, matrix: number[], opentype: any): string {
  if (!matrix || (matrix[0] === 1 && matrix[1] === 0 && matrix[2] === 0 && matrix[3] === 1 && matrix[4] === 0 && matrix[5] === 0)) {
    return pathData;
  }
  try {
    const noArcs = arcsToCubics(pathData);
    const path = opentype.Path.fromSVG(noArcs);
    path.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
    return sanitizePathData(path.toPathData(2));
  } catch {
    return pathData;
  }
}

function shapeToPath(el: Element, opentype: any): string {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "path":
      return el.getAttribute("d") || "";
    case "circle": {
      const cx = parseFloat(el.getAttribute("cx") || "0");
      const cy = parseFloat(el.getAttribute("cy") || "0");
      const r = parseFloat(el.getAttribute("r") || "0");
      if (!r) return "";
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
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
        // Simplified: use uniform rx if rx ≈ ry, otherwise approximate
        if (Math.abs(rrx - rry) < 0.001) {
          return `M ${x + rrx} ${y} H ${x + w - rrx} A ${rrx} ${rrx} 0 0 1 ${x + w} ${y + rrx} V ${y + h - rrx} A ${rrx} ${rrx} 0 0 1 ${x + w - rrx} ${y + h} H ${x + rrx} A ${rrx} ${rrx} 0 0 1 ${x} ${y + h - rrx} V ${y + rrx} A ${rrx} ${rrx} 0 0 1 ${x + rrx} ${y} Z`;
        }
        // Fallback to sharp rect when rx != ry (opentype.js doesn't support elliptical arcs well)
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
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
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
      const nums = points.trim().split(/[\s,]+/).filter(Boolean);
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

function flattenSVG(svg: SVGElement, opentype: any): { d: string; viewBox: string } | null {
  const viewBox = svg.getAttribute("viewBox") || svg.getAttribute("viewbox") || "0 0 1024 1024";
  const parts: string[] = [];

  const traverse = (el: Element, parentMatrix: number[]) => {
    const tag = el.tagName.toLowerCase();

    // Skip invisible elements
    const display = el.getAttribute("display");
    if (display === "none") return;

    // Skip defs/clipPath/mask (they are referenced, not rendered directly)
    if (["defs", "clippath", "mask", "metadata", "title", "desc", "script", "style"].includes(tag)) {
      return;
    }

    const transform = el.getAttribute("transform");
    const localMatrix = transform ? parseTransform(transform) : [1, 0, 0, 1, 0, 0];
    const currentMatrix = multiplyMatrix(parentMatrix, localMatrix);

    if (["path", "circle", "rect", "ellipse", "line", "polyline", "polygon"].includes(tag)) {
      const pd = shapeToPath(el, opentype);
      if (pd) {
        const transformed = transformPathData(pd, currentMatrix, opentype);
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

function extractSVGPath(svgContent: string, opentype: any): { d: string; viewBox: string } | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;

  return flattenSVG(svg as SVGElement, opentype);
}

function parseViewBox(viewBox: string): { minX: number; minY: number; width: number; height: number } {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  return {
    minX: parts[0] || 0,
    minY: parts[1] || 0,
    width: parts[2] || 1024,
    height: parts[3] || 1024,
  };
}

export async function generateTTFFont(
  fontFamily: string,
  icons: Icon[],
  prefix: string
): Promise<ArrayBuffer | null> {
  const opentype = await loadOpentype();

  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: 650,
    path: new opentype.Path(),
  });

  const glyphs: any[] = [notdefGlyph];

  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    const content = icon.content || "";
    const extracted = extractSVGPath(content, opentype);
    if (!extracted) continue;

    const { d, viewBox } = extracted;
    const vb = parseViewBox(viewBox);

    // Scale SVG path to font units (typically 1000 units per em)
    const unitsPerEm = 1000;
    const scale = unitsPerEm / Math.max(vb.width, vb.height);

    try {
      const noArcs = arcsToCubics(d);
      const path = opentype.Path.fromSVG(noArcs);
      // Scale and flip Y (SVG Y-down to font Y-up)
      // Map SVG (minX, minY) to font (0, unitsPerEm)
      const scaleMatrix = [scale, 0, 0, -scale, -vb.minX * scale, unitsPerEm + vb.minY * scale];
      path.transform(...scaleMatrix as [number, number, number, number, number, number]);

      const unicode = icon.unicode
        ? parseInt(icon.unicode.replace(/^&#x?|^\\|^U\+/i, "").replace(/;$/, ""), 16)
        : 0xe000 + i;

      const glyph = new opentype.Glyph({
        name: `${prefix}${icon.name}`,
        unicode: unicode,
        advanceWidth: unitsPerEm,
        path: path,
      });
      glyphs.push(glyph);
    } catch (e: any) {
      console.warn(`Failed to process icon ${icon.name}:`, e);
      // Log path data for debugging — truncated to avoid flooding console
      if (e?.message?.includes("Unexpected character")) {
        console.warn(`  Original path (first 500 chars):`, d.slice(0, 500));
        try {
          const noArcs = arcsToCubics(d);
          console.warn(`  Converted path (first 500 chars):`, noArcs.slice(0, 500));
        } catch {}
      }
    }
  }

  if (glyphs.length <= 1) return null;

  const font = new opentype.Font({
    familyName: fontFamily,
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 1000,
    descender: 0,
    glyphs: glyphs,
  });

  return font.toArrayBuffer();
}

export function generateCSS(fontFamily: string, prefix: string, icons: Icon[]): string {
  const classes = icons
    .map((icon, i) => {
      const unicode = icon.unicode || `\\${(0xe000 + i).toString(16)}`;
      return `.${prefix}${icon.name}:before { content: "${unicode}"; }`;
    })
    .join("\n");

  return `@font-face {
  font-family: "${fontFamily}";
  src: url("./${fontFamily}.ttf") format("truetype");
  font-weight: normal;
  font-style: normal;
}

.${prefix} {
  font-family: "${fontFamily}" !important;
  font-size: 16px;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

${classes}
`;
}

/** Extract inner SVG content reliably using DOMParser */
function extractInnerSVG(content: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return content;
  // Return all children serialized
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

export async function generateDemoHTML(fontFamily: string, prefix: string, icons: Icon[]): Promise<string> {
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
    : css.match(/@font-face\s*\{[^}]+\}/s)?.[0] ?? "";

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
      .join("\n    ")}\n  </style>\n</head>\n<body>\n  <h1>${fontFamily} - ${icons.length} Icons</h1>\n  <ul class="icon-list">\n${items}\n  </ul>\n  <div class="copy-toast" id="toast">已复制到剪贴板</div>\n  <script>\n    document.querySelectorAll('.icon-item i').forEach(function(el) {\n      el.style.cursor = 'pointer';\n      el.title = '点击复制 class 名';\n      el.addEventListener('click', function() {\n        var cls = this.className.split(' ').pop();\n        navigator.clipboard.writeText('<i class="${prefix} ' + cls + '"></i>').then(function() {\n          var toast = document.getElementById('toast');\n          toast.classList.add('show');\n          setTimeout(function() { toast.classList.remove('show'); }, 1500);\n        });\n      });\n    });\n  </script>\n</body>\n</html>`;
}
