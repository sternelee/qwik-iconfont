// GitHub URL utilities used by the import API.
// The curated ICON_LIBRARIES preset list has been removed —
// imports now require an explicit GitHub tree URL.

export interface ParsedGitHubUrl {
  repo: string; // "owner/repo"
  branch: string; // "main" | "master" | ...
  path: string; // "packages/static-svg/icons" (no leading/trailing slash)
  label: string; // human-readable display name e.g. "lobehub/lobe-icons"
}

/**
 * Parse any GitHub tree URL into { repo, branch, path, label }.
 *
 * Supported formats:
 *   https://github.com/owner/repo/tree/branch/path/to/icons
 *   https://github.com/owner/repo/tree/branch   (root of branch)
 *   https://github.com/owner/repo               (default branch, root)
 *
 * Returns null for non-GitHub URLs or malformed input.
 */
export function parseGitHubUrl(raw: string): ParsedGitHubUrl | null {
  try {
    const trimmed = raw.trim();
    const normalized = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    const u = new URL(normalized);
    if (!u.hostname.endsWith("github.com")) return null;

    const parts = u.pathname.replace(/^\/|\/$/g, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;

    const repo = `${parts[0]}/${parts[1].replace(/\.git$/, "")}`;

    if (parts[2] === "tree") {
      const branch = parts[3] ?? "main";
      const path = parts.slice(4).join("/");
      return { repo, branch, path, label: repo };
    }

    return { repo, branch: "main", path: "", label: repo };
  } catch {
    return null;
  }
}

/** Build a raw.githubusercontent.com URL for a file in the repo. */
export function rawGitHubUrl(
  repo: string,
  branch: string,
  filePath: string,
): string {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
}
