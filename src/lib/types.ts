export interface Project {
  id: number;
  name: string;
  description: string | null;
  font_family: string;
  prefix: string;
  icon_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Icon {
  id: number;
  project_id: number;
  name: string;
  unicode: string | null;
  svg_path: string;
  view_box: string | null;
  width: number | null;
  height: number | null;
  content: string | null;
  tags: string | null; // Comma-separated tags for categorization
  created_at: string;
  updated_at: string;
}

export interface ProjectWithIcons extends Project {
  icons: Icon[];
}

export interface IconUpload {
  name: string;
  content: string;
  unicode?: string;
  tags?: string;
}

export const DEFAULT_VIEW_BOX = "0 0 1024 1024";

export function extractSvgViewBox(svg: string | null | undefined): string | null {
  if (!svg) return null;

  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/i);
  if (viewBoxMatch?.[1]?.trim()) {
    return viewBoxMatch[1].trim();
  }

  const widthMatch = svg.match(/\bwidth=["'](\d+(?:\.\d+)?)["']/i);
  const heightMatch = svg.match(/\bheight=["'](\d+(?:\.\d+)?)["']/i);
  if (widthMatch?.[1] && heightMatch?.[1]) {
    return `0 0 ${widthMatch[1]} ${heightMatch[1]}`;
  }

  return null;
}

export function resolveSvgViewBox(
  viewBox: string | null | undefined,
  svg: string | null | undefined,
): string {
  const normalizedViewBox = viewBox?.trim();
  const detectedViewBox = extractSvgViewBox(svg);

  if (
    detectedViewBox &&
    (!normalizedViewBox || normalizedViewBox === DEFAULT_VIEW_BOX)
  ) {
    return detectedViewBox;
  }

  return normalizedViewBox || detectedViewBox || DEFAULT_VIEW_BOX;
}

// Tag management helpers
export function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}

export function formatTags(tags: string[]): string {
  return tags.join(",");
}

// Icon with parsed tags for UI use
export interface IconWithTags extends Icon {
  tagList: string[];
}