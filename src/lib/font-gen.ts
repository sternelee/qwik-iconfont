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

/** Apply 2x3 matrix to a path data string by transforming the path via opentype.js */
function transformPathData(pathData: string, matrix: number[], opentype: any): string {
  if (!matrix || (matrix[0] === 1 && matrix[1] === 0 && matrix[2] === 0 && matrix[3] === 1 && matrix[4] === 0 && matrix[5] === 0)) {
    return pathData;
  }
  try {
    const path = opentype.Path.fromSVG(pathData);
    path.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
    return path.toPathData(2);
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
      const path = opentype.Path.fromSVG(d);
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
    } catch (e) {
      console.warn(`Failed to process icon ${icon.name}:`, e);
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
