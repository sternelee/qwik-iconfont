import type { Icon } from "./types";

let opentypeModule: any = null;

async function loadOpentype() {
  if (!opentypeModule) {
    opentypeModule = await import("opentype.js");
  }
  return opentypeModule;
}

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
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case "rect": {
      const x = parseFloat(el.getAttribute("x") || "0");
      const y = parseFloat(el.getAttribute("y") || "0");
      const w = parseFloat(el.getAttribute("width") || "0");
      const h = parseFloat(el.getAttribute("height") || "0");
      const rx = parseFloat(el.getAttribute("rx") || "0");
      if (!w || !h) return "";
      if (rx) {
        return `M ${x + rx} ${y} H ${x + w - rx} A ${rx} ${rx} 0 0 1 ${x + w} ${y + rx} V ${y + h - rx} A ${rx} ${rx} 0 0 1 ${x + w - rx} ${y + h} H ${x + rx} A ${rx} ${rx} 0 0 1 ${x} ${y + h - rx} V ${y + rx} A ${rx} ${rx} 0 0 1 ${x + rx} ${y} Z`;
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

function flattenSVG(svg: SVGElement): { d: string; viewBox: string } | null {
  const viewBox = svg.getAttribute("viewBox") || "0 0 1024 1024";
  const parts: string[] = [];

  const traverse = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (["path", "circle", "rect", "ellipse", "line", "polyline", "polygon"].includes(tag)) {
      const pd = shapeToPath(el);
      if (pd) parts.push(pd);
    }
    for (const child of Array.from(el.children)) {
      traverse(child);
    }
  };

  traverse(svg);

  if (parts.length === 0) return null;
  return { d: parts.join(" "), viewBox };
}

function extractSVGPath(svgContent: string): { d: string; viewBox: string } | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;

  return flattenSVG(svg as SVGElement);
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
    const extracted = extractSVGPath(content);
    if (!extracted) continue;

    const { d, viewBox } = extracted;
    const vb = parseViewBox(viewBox);

    // Scale SVG path to font units (typically 1000 units per em)
    const unitsPerEm = 1000;
    const scale = unitsPerEm / Math.max(vb.width, vb.height);

    try {
      const path = opentype.Path.fromSVG(d);
      // Scale and flip Y (SVG Y-down to font Y-up)
      const scaleMatrix = [scale, 0, 0, -scale, -vb.minX * scale, unitsPerEm + vb.minY * scale];
      path.transform(...scaleMatrix as [number, number, number, number, number, number]);

      const unicode = icon.unicode
        ? parseInt(icon.unicode.replace(/^&#x?|^\\|^U\+/i, "").replace(/;$/, ""), 16)
        : 0xe000 + i;

      const glyph = new opentype.Glyph({
        name: `${prefix}${icon.name}`,
        unicode: unicode,
        advanceWidth: vb.width * scale,
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
    ascender: 800,
    descender: -200,
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
  src: url("${fontFamily}.ttf") format("truetype");
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

export function generateSymbolSVG(icons: Icon[], prefix: string): string {
  const symbols = icons
    .map((icon) => {
      const content = icon.content || "";
      const viewBox = icon.view_box || "0 0 1024 1024";
      // Remove outer svg tags and keep inner content
      const inner = content.replace(/<svg[^>]*>/gi, "").replace(/<\/svg>/gi, "");
      return `  <symbol id="${prefix}${icon.name}" viewBox="${viewBox}">${inner}</symbol>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true">\n  <defs>\n${symbols}\n  </defs>\n</svg>`;
}

export function generateDemoHTML(fontFamily: string, prefix: string, icons: Icon[]): string {
  const items = icons
    .map((icon, i) => {
      const unicode = icon.unicode || `&#x${(0xe000 + i).toString(16)};`;
      return `    <li class="icon-item">\n      <i class="${prefix} ${prefix}${icon.name}"></i>\n      <div class="name">${icon.name}</div>\n      <div class="code">${unicode}</div>\n    </li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>${fontFamily} - Icon Demo</title>\n  <link rel="stylesheet" href="${fontFamily}.css">\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; background: #f5f5f5; }\n    h1 { text-align: center; margin-bottom: 40px; }\n    .icon-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 20px; list-style: none; padding: 0; }\n    .icon-item { background: #fff; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }\n    .icon-item i { font-size: 32px; color: #333; display: block; margin-bottom: 8px; }\n    .icon-item .name { font-size: 12px; color: #666; margin-bottom: 4px; }\n    .icon-item .code { font-size: 11px; color: #999; font-family: monospace; }\n  </style>\n</head>\n<body>\n  <h1>${fontFamily} - ${icons.length} Icons</h1>\n  <ul class="icon-list">\n${items}\n  </ul>\n</body>\n</html>`;
}
