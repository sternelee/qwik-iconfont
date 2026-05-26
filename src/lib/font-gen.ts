import type { Icon } from "./types";

let opentypeModule: any = null;

async function loadOpentype() {
  if (!opentypeModule) {
    opentypeModule = await import("opentype.js");
  }
  return opentypeModule;
}

function extractSVGPath(svgContent: string): { d: string; viewBox: string } | null {
  // Parse SVG using DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;

  // Try to get path data from <path> element
  const pathEl = svg.querySelector("path");
  let d = pathEl?.getAttribute("d") || "";

  // If no path, try to combine multiple paths
  if (!d) {
    const paths = svg.querySelectorAll("path");
    const parts: string[] = [];
    paths.forEach((p) => {
      const pd = p.getAttribute("d");
      if (pd) parts.push(pd);
    });
    d = parts.join(" ");
  }

  if (!d) return null;

  const viewBox = svg.getAttribute("viewBox") || "0 0 1024 1024";
  return { d, viewBox };
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
