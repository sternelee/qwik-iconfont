/**
 * COLRv0 font generation.
 *
 * Generates a TrueType font with COLRv0 + CPAL tables that allow multi-colour
 * glyph rendering in all browsers from IE9 / iOS 11 onward.
 *
 * Pipeline:
 *   1. For each icon with colour layers, assign a PUA codepoint per layer glyph.
 *   2. Build an SVG font XML that contains:
 *        - base glyphs  (one per icon, at its regular unicode slot)
 *        - layer glyphs (one per colour layer, at private U+E800+ slots)
 *   3. Convert the SVG font → TTF binary via svg2ttf.
 *   4. Parse the resulting TTF header and inject two new tables:
 *        COLR — maps base glyph GIDs → layer GID lists with palette indices
 *        CPAL — defines the colour palette (BGRA, one palette)
 *   5. Rebuild the font with an updated table directory and recalculated
 *      checksums.
 */

import svg2ttf from "svg2ttf";
import svgpathFn from "svgpath";
import type { Icon } from "./types";
import type { StoredColorLayer } from "./svg-color-extractor";

// ── Constants ────────────────────────────────────────────────────────────────

const ASCENT = 850;
const DESCENT = -150;
const UPM = 1000;
/** First PUA codepoint used for internal layer glyphs. */
const LAYER_PUA_START = 0xe800;

// ── Colour utilities ─────────────────────────────────────────────────────────

function parseHex(hex: string): { r: number; g: number; b: number; a: number } {
  const s = hex.replace("#", "");
  if (s.length === 6) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
      a: 255,
    };
  }
  if (s.length === 8) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
      a: parseInt(s.slice(6, 8), 16),
    };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

// ── TTF path transformation ───────────────────────────────────────────────────

function transformToFontCoords(
  d: string,
  viewBox: { minX: number; minY: number; width: number; height: number },
): string {
  const scale = UPM / Math.max(viewBox.width, viewBox.height);
  try {
    return svgpathFn(d)
      .unarc()
      .unshort()
      .abs()
      .scale(scale, -scale)
      .translate(-viewBox.minX * scale, ASCENT + viewBox.minY * scale)
      .round(0)
      .rel()
      .toString();
  } catch {
    return "";
  }
}

function sanitize(d: string): string {
  return d.replace(/\s+/g, " ").trim();
}

// ── SVG font XML builder ──────────────────────────────────────────────────────

interface GlyphSpec {
  name: string;
  unicode: number; // codepoint
  d: string; // path in font coords
}

function buildSVGFont(family: string, glyphs: GlyphSpec[]): string {
  const lines = glyphs.map(
    (g) =>
      `<glyph glyph-name="${g.name}" unicode="&#x${g.unicode.toString(16)};" ` +
      `d="${g.d}" horiz-adv-x="${UPM}" />`,
  );
  return [
    `<?xml version="1.0" standalone="no"?>`,
    `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`,
    `<svg xmlns="http://www.w3.org/2000/svg">`,
    `<defs>`,
    `<font id="${family}" horiz-adv-x="${UPM}">`,
    `<font-face font-family="${family}" units-per-em="${UPM}" ascent="${ASCENT}" descent="${DESCENT}" />`,
    `<missing-glyph horiz-adv-x="${UPM}" />`,
    ...lines,
    `</font></defs></svg>`,
  ].join("\n");
}

// ── COLR binary table ────────────────────────────────────────────────────────

/**
 * Build a COLRv0 table.
 *
 * @param coloredBaseGIDs  GIDs of the base glyphs that have colour layers,
 *                         in ascending GID order (required by spec).
 * @param layerMap         Map from base GID → array of {layerGID, paletteIndex}.
 */
function buildCOLRTable(
  coloredBaseGIDs: number[],
  layerMap: Map<number, { layerGID: number; paletteIndex: number }[]>,
): Uint8Array {
  const sorted = [...coloredBaseGIDs].sort((a, b) => a - b);
  const numBase = sorted.length;
  const totalLayers = sorted.reduce(
    (s, gid) => s + (layerMap.get(gid)?.length ?? 0),
    0,
  );

  // Header (14) + BaseGlyphRecord[] (6×numBase) + LayerRecord[] (4×totalLayers)
  const headerSize = 14;
  const size = headerSize + numBase * 6 + totalLayers * 4;
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  let off = 0;

  v.setUint16((off += 0), 0, false);
  off += 2; // version = 0
  v.setUint16(off, numBase, false);
  off += 2; // numBaseGlyphRecords
  v.setUint32(off, headerSize, false);
  off += 4; // offsetBaseGlyphRecord
  v.setUint32(off, headerSize + numBase * 6, false);
  off += 4; // offsetLayerRecord
  v.setUint16(off, totalLayers, false);
  off += 2; // numLayerRecords

  // BaseGlyphRecords
  let layerIdx = 0;
  for (const gid of sorted) {
    const layers = layerMap.get(gid)!;
    v.setUint16(off, gid, false);
    off += 2;
    v.setUint16(off, layerIdx, false);
    off += 2;
    v.setUint16(off, layers.length, false);
    off += 2;
    layerIdx += layers.length;
  }

  // LayerRecords
  for (const gid of sorted) {
    for (const lr of layerMap.get(gid)!) {
      v.setUint16(off, lr.layerGID, false);
      off += 2;
      v.setUint16(off, lr.paletteIndex, false);
      off += 2;
    }
  }

  return new Uint8Array(buf);
}

// ── CPAL binary table ────────────────────────────────────────────────────────

/** Build a CPALv0 table for a single palette. */
function buildCPALTable(palette: string[]): Uint8Array {
  const n = palette.length;
  // Header: version(2)+numPaletteEntries(2)+numPalettes(2)+numColorRecords(2)
  //         +offsetFirstColorRecord(4)+colorRecordIndices[1](2) = 14 bytes
  const headerSize = 14;
  const size = headerSize + n * 4; // ColorRecord = 4 bytes BGRA
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  let off = 0;

  v.setUint16(off, 0, false);
  off += 2; // version = 0
  v.setUint16(off, n, false);
  off += 2; // numPaletteEntries
  v.setUint16(off, 1, false);
  off += 2; // numPalettes
  v.setUint16(off, n, false);
  off += 2; // numColorRecords
  v.setUint32(off, headerSize, false);
  off += 4; // offsetFirstColorRecord
  v.setUint16(off, 0, false);
  off += 2; // colorRecordIndices[0] = 0

  for (const hex of palette) {
    const { r, g, b, a } = parseHex(hex);
    // BGRA byte order
    v.setUint8(off++, b);
    v.setUint8(off++, g);
    v.setUint8(off++, r);
    v.setUint8(off++, a);
  }

  return new Uint8Array(buf);
}

// ── TTF table injection ───────────────────────────────────────────────────────

function calcChecksum(bytes: Uint8Array): number {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sum = 0;
  for (let i = 0; i < Math.floor(bytes.length / 4); i++) {
    sum = (sum + v.getUint32(i * 4, false)) >>> 0;
  }
  return sum;
}

function padTo4(data: Uint8Array): Uint8Array {
  const len = Math.ceil(data.length / 4) * 4;
  const out = new Uint8Array(len);
  out.set(data);
  return out;
}

/**
 * Inject COLR + CPAL tables into an existing TTF binary.
 *
 * The existing table directory is shifted by 32 bytes (2 × 16-byte entries)
 * and the two new entries are inserted at the end of the directory, then
 * the font's head.checkSumAdjustment is recalculated.
 */
function injectColorTables(
  ttf: ArrayBuffer,
  colrData: Uint8Array,
  cpalData: Uint8Array,
): ArrayBuffer {
  const origView = new DataView(ttf);
  const numTablesOrig = origView.getUint16(4, false);
  const numTablesNew = numTablesOrig + 2;

  // Parse existing table directory
  interface TableEntry {
    tag: string;
    checksum: number;
    offset: number;
    length: number;
  }
  const existingTables: TableEntry[] = [];
  for (let i = 0; i < numTablesOrig; i++) {
    const base = 12 + i * 16;
    const tag = [0, 1, 2, 3]
      .map((j) => String.fromCharCode(origView.getUint8(base + j)))
      .join("");
    existingTables.push({
      tag,
      checksum: origView.getUint32(base + 4, false),
      offset: origView.getUint32(base + 8, false),
      length: origView.getUint32(base + 12, false),
    });
  }

  // Offset of first byte after the old directory
  const oldDirEnd = 12 + numTablesOrig * 16;
  const newDirEnd = 12 + numTablesNew * 16;
  // All existing table offsets shift by the extra directory bytes
  const shift = newDirEnd - oldDirEnd; // = 32

  const colrPadded = padTo4(colrData);
  const cpalPadded = padTo4(cpalData);

  // Existing table data runs from oldDirEnd to end of original file.
  // After shift it starts at newDirEnd.
  const existingDataSize = ttf.byteLength - oldDirEnd;
  const colrOffset = newDirEnd + existingDataSize;
  const cpalOffset = colrOffset + colrPadded.length;
  const totalSize = cpalOffset + cpalPadded.length;

  const colrChecksum = calcChecksum(colrPadded);
  const cpalChecksum = calcChecksum(cpalPadded);

  // Build new table directory (sorted alphabetically by tag — required)
  const allTables: TableEntry[] = [
    ...existingTables.map((t) => ({
      ...t,
      offset: t.offset + shift,
    })),
    {
      tag: "COLR",
      checksum: colrChecksum,
      offset: colrOffset,
      length: colrData.length,
    },
    {
      tag: "CPAL",
      checksum: cpalChecksum,
      offset: cpalOffset,
      length: cpalData.length,
    },
  ].sort((a, b) => a.tag.localeCompare(b.tag));

  // Allocate new buffer
  const newBuf = new ArrayBuffer(totalSize);
  const newView = new DataView(newBuf);
  const newBytes = new Uint8Array(newBuf);

  // Copy existing table data (body, not directory)
  newBytes.set(new Uint8Array(ttf, oldDirEnd, existingDataSize), newDirEnd);

  // Write new header
  const searchRange = Math.pow(2, Math.floor(Math.log2(numTablesNew))) * 16;
  const entrySelector = Math.floor(Math.log2(numTablesNew));
  const rangeShift = numTablesNew * 16 - searchRange;

  newView.setUint32(0, 0x00010000, false); // sfVersion = TrueType
  newView.setUint16(4, numTablesNew, false);
  newView.setUint16(6, searchRange, false);
  newView.setUint16(8, entrySelector, false);
  newView.setUint16(10, rangeShift, false);

  // Write table directory entries
  for (let i = 0; i < allTables.length; i++) {
    const t = allTables[i];
    const base = 12 + i * 16;
    for (let j = 0; j < 4; j++) newView.setUint8(base + j, t.tag.charCodeAt(j));
    newView.setUint32(base + 4, t.checksum, false);
    newView.setUint32(base + 8, t.offset, false);
    newView.setUint32(base + 12, t.length, false);
  }

  // Append COLR + CPAL data
  newBytes.set(colrPadded, colrOffset);
  newBytes.set(cpalPadded, cpalOffset);

  // Fix head.checkSumAdjustment (offset +8 inside head table)
  const headEntry = allTables.find((t) => t.tag === "head");
  if (headEntry) {
    newView.setUint32(headEntry.offset + 8, 0, false); // zero it first
    const fontSum = calcChecksum(new Uint8Array(newBuf));
    newView.setUint32(
      headEntry.offset + 8,
      (0xb1b0afba - fontSum) >>> 0,
      false,
    );
  }

  return newBuf;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface IconWithColorLayers extends Icon {
  /** Parsed colour layers (from DB's color_layers JSON field). */
  parsedColorLayers?: StoredColorLayer[];
}

/**
 * Generate a COLRv0 TrueType font from icons, some of which may have colour
 * layer data.
 *
 * Icons without colour layers render as standard monochrome glyphs.
 * Icons with colour layers get base + layer glyphs with COLR/CPAL tables.
 */
export async function generateCOLRFont(
  fontFamily: string,
  icons: IconWithColorLayers[],
  prefix: string,
): Promise<ArrayBuffer | null> {
  // ── Step 1: classify icons ──────────────────────────────────────
  const viewBoxCache = new Map<
    number,
    { minX: number; minY: number; width: number; height: number }
  >();

  function parseVB(vb: string) {
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

  // ── Step 2: build global colour palette ──────────────────────────
  const paletteSet: string[] = [];
  const paletteIdx = new Map<string, number>();

  function getPaletteIndex(hex: string): number {
    if (paletteIdx.has(hex)) return paletteIdx.get(hex)!;
    const idx = paletteSet.length;
    paletteSet.push(hex);
    paletteIdx.set(hex, idx);
    return idx;
  }

  // ── Step 3: build SVG font glyphs ───────────────────────────────
  const svgFontGlyphs: GlyphSpec[] = [];

  // GID 0 = .notdef (svg2ttf adds automatically)
  // GID 1..N = icon base glyphs  (in array order)
  // GID N+1.. = layer glyphs

  let baseCharCode = 0xe001;
  let layerPua = LAYER_PUA_START; // U+E800

  // Track layer glyph specs separately (appended after all base glyphs)
  const layerGlyphs: GlyphSpec[] = [];
  // COLR layer map: baseGID → [{layerGID, paletteIndex}]
  const colrLayerMap = new Map<
    number,
    { layerGID: number; paletteIndex: number }[]
  >();

  // Base glyph GID = 1-based index in svgFontGlyphs array + 1 (for .notdef)
  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    const unicode = icon.unicode
      ? parseInt(
          icon.unicode.replace(/^&#x?|^\\|^U\+/i, "").replace(/;$/, ""),
          16,
        )
      : baseCharCode++;

    const vb = parseVB(icon.view_box || "0 0 1024 1024");
    const layers = icon.parsedColorLayers;

    // Base glyph: use first layer path as monochrome fallback
    let basePath = "";
    if (icon.content) {
      // Extract first path group for monochrome fallback via existing font-gen helper
      try {
        const { extractSVGPath } = await import("~/lib/font-gen");
        const extracted = extractSVGPath(icon.content);
        if (extracted) {
          basePath = sanitize(transformToFontCoords(extracted.d, vb));
        }
      } catch {
        /* skip fallback path */
      }
    }

    const baseGID = svgFontGlyphs.length + 1; // +1 for .notdef

    svgFontGlyphs.push({
      name: `${prefix}${icon.name}`,
      unicode,
      d: basePath,
    });

    if (layers && layers.length > 1) {
      // Coloured icon — build layer glyphs
      const iconColrLayers: { layerGID: number; paletteIndex: number }[] = [];

      for (const layer of layers) {
        const transformedD = sanitize(transformToFontCoords(layer.d, vb));
        if (!transformedD) continue;

        const layerGID = svgFontGlyphs.length + layerGlyphs.length + 1; // +1 for .notdef
        const colorKey =
          layer.color === "currentColor" ? "#000000" : layer.color;
        const pIdx = getPaletteIndex(colorKey);

        layerGlyphs.push({
          name: `${prefix}${icon.name}_layer${iconColrLayers.length}`,
          unicode: layerPua++,
          d: transformedD,
        });

        iconColrLayers.push({ layerGID, paletteIndex: pIdx });
      }

      if (iconColrLayers.length > 0) {
        colrLayerMap.set(baseGID, iconColrLayers);
      }
    }
  }

  if (svgFontGlyphs.length === 0) return null;

  // Append layer glyphs after base glyphs
  const allGlyphs = [...svgFontGlyphs, ...layerGlyphs];

  // ── Step 4: SVG font → TTF ────────────────────────────────────────
  const svgFont = buildSVGFont(fontFamily, allGlyphs);
  let ttfBuffer: ArrayBuffer;
  try {
    const ttf = svg2ttf(svgFont, {});
    ttfBuffer = (ttf.buffer.buffer as ArrayBuffer).slice(
      ttf.buffer.byteOffset,
      ttf.buffer.byteOffset + ttf.buffer.byteLength,
    );
  } catch (e) {
    console.error("svg2ttf failed:", e);
    return null;
  }

  // ── Step 5: inject COLR + CPAL if any coloured icons ────────────
  if (colrLayerMap.size === 0) {
    // No coloured icons — return plain TTF
    return ttfBuffer;
  }

  const coloredBaseGIDs = [...colrLayerMap.keys()];
  const colrTable = buildCOLRTable(coloredBaseGIDs, colrLayerMap);
  const cpalTable = buildCPALTable(paletteSet);

  return injectColorTables(ttfBuffer, colrTable, cpalTable);
}

// ── CSS generation for COLR font ──────────────────────────────────────────────

export function generateCOLRFontCSS(
  fontFamily: string,
  prefix: string,
  icons: Icon[],
): string {
  const rules = icons
    .map((icon, i) => {
      const unicode = icon.unicode || `\\${(0xe001 + i).toString(16)}`;
      return `.${prefix}${icon.name}::before { content: "${unicode}"; }`;
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
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

  ${rules}`;
}
