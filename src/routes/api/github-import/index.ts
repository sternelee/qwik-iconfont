import type { RequestHandler } from "@builder.io/qwik-city";
import {
  ICON_LIBRARIES,
  getLibrary,
  resolveIconsPath,
  rawGitHubUrl,
} from "~/lib/github-registry";
import { extractSvgViewBox, DEFAULT_VIEW_BOX } from "~/lib/types";

// ── Per-Worker in-memory cache (cleared on Worker restart) ──────────────────
const treeCache = new Map<string, { names: string[]; cachedAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

// ── GitHub URL parser ────────────────────────────────────────────────────────
// Parses any GitHub tree URL into { repo, branch, path }.
//
// Supported formats:
//   https://github.com/owner/repo/tree/branch/path/to/icons
//   https://github.com/owner/repo/tree/branch          (root of branch)
//   https://github.com/owner/repo                       (default branch, root)
export interface ParsedGitHubUrl {
  repo: string; // "owner/repo"
  branch: string; // "main" | "master" | ...
  path: string; // "packages/static-svg/icons" (no leading/trailing slash)
  label: string; // human-readable display name
}

export function parseGitHubUrl(raw: string): ParsedGitHubUrl | null {
  try {
    const trimmed = raw.trim();
    const normalized = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    const u = new URL(normalized);
    if (!u.hostname.endsWith("github.com")) return null;

    // pathname: /owner/repo[/tree/branch[/path/...]]
    const parts = u.pathname.replace(/^\/|\/$/g, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;

    const repo = `${parts[0]}/${parts[1].replace(/\.git$/, "")}`;

    if (parts[2] === "tree") {
      const branch = parts[3] ?? "main";
      const path = parts.slice(4).join("/");
      return { repo, branch, path, label: repo };
    }

    // Plain repo URL — assume main branch, root directory
    return { repo, branch: "main", path: "", label: repo };
  } catch {
    return null;
  }
}

// ── Fetch SVG names from GitHub Trees API ────────────────────────────────────
async function fetchIconNames(
  repo: string,
  branch: string,
  iconsPath: string,
  token?: string,
): Promise<string[]> {
  const key = `${repo}/${branch}/${iconsPath}`;
  const hit = treeCache.get(key);
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL) return hit.names;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "qwik-iconfont/1.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers },
  );

  if (!res.ok) {
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (remaining === "0") {
      throw new Error(
        "GitHub API 请求次数已达上限，请稍后重试。配置 GITHUB_TOKEN 环境变量可获得更高限额。",
      );
    }
    throw new Error(`GitHub API 返回 ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as {
    tree: { path: string; type: string }[];
    truncated: boolean;
  };

  const prefix = iconsPath ? `${iconsPath}/` : "";
  const names = data.tree
    .filter(
      (f) =>
        f.type === "blob" &&
        f.path.startsWith(prefix) &&
        f.path.endsWith(".svg") &&
        // only direct children of iconsPath — skip nested subdirectories
        !f.path.slice(prefix.length).includes("/"),
    )
    .map((f) => f.path.slice(prefix.length, -4)); // strip prefix + ".svg"

  treeCache.set(key, { names, cachedAt: Date.now() });
  return names;
}

// ── Shared: resolve repo/branch/path from either registry or raw URL ─────────
function resolveSource(
  registryId: string | null,
  variantId: string | undefined,
  githubUrl: string | null,
): ParsedGitHubUrl | { error: string } {
  if (githubUrl) {
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed)
      return {
        error: "无效的 GitHub URL，请粘贴仓库目录页面的完整 URL",
      };
    return parsed;
  }
  if (registryId) {
    const library = getLibrary(registryId);
    if (!library) return { error: "未知图标库" };
    const path = resolveIconsPath(library, variantId);
    return {
      repo: library.repo,
      branch: library.branch,
      path,
      label: library.name,
    };
  }
  return { error: "缺少 registry 或 url 参数" };
}

// ── GET /api/github-import ────────────────────────────────────────────────────
// Curated:   ?registry=lucide[&variant=outline][&search=arrow]
// Custom:    ?url=https://github.com/owner/repo/tree/branch/path[&search=...]
// No params: returns library list (used by UI library picker)
export const onGet: RequestHandler = async ({ url, json, platform }) => {
  const registryId = url.searchParams.get("registry");
  const variantId = url.searchParams.get("variant") ?? undefined;
  const githubUrl = url.searchParams.get("url");
  const search = url.searchParams.get("search")?.toLowerCase().trim() ?? "";

  // No source specified → return curated library list
  if (!registryId && !githubUrl) {
    json(200, { libraries: ICON_LIBRARIES });
    return;
  }

  const source = resolveSource(registryId, variantId, githubUrl);
  if ("error" in source) {
    json(400, { error: source.error });
    return;
  }

  const token = (platform as any)?.env?.GITHUB_TOKEN as string | undefined;

  try {
    let names = await fetchIconNames(
      source.repo,
      source.branch,
      source.path,
      token,
    );

    if (search) {
      names = names.filter((n) => n.toLowerCase().includes(search));
    }

    const baseRaw = rawGitHubUrl(source.repo, source.branch, source.path);

    json(200, {
      library: registryId ?? null,
      variant: variantId ?? null,
      repo: source.repo,
      branch: source.branch,
      path: source.path,
      label: source.label,
      total: names.length,
      icons: names.map((name) => ({
        name,
        previewUrl: `${baseRaw}/${name}.svg`,
      })),
    });
    return;
  } catch (err: any) {
    json(502, { error: err.message });
    return;
  }
};

// ── POST /api/github-import ───────────────────────────────────────────────────
// Curated:   { registry, variant?, icons, projectName }
// Custom:    { url, icons, projectName }
// Creates a project, fetches SVGs from GitHub, stores to R2 + D1.
export const onPost: RequestHandler = async ({ json, request, platform }) => {
  const { getSessionFromRequest } = await import("~/lib/session");
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "请先登录" });
    return;
  }

  const body = (await request.json()) as {
    registry?: string;
    variant?: string;
    url?: string; // custom GitHub tree URL
    icons: string[];
    projectName: string;
  };

  const {
    registry,
    variant,
    url: githubUrl,
    icons: iconNames,
    projectName,
  } = body;

  if (!Array.isArray(iconNames) || iconNames.length === 0) {
    json(400, { error: "请至少选择一个图标" });
    return;
  }
  if (!projectName?.trim()) {
    json(400, { error: "请输入图标集名称" });
    return;
  }
  if (iconNames.length > 500) {
    json(400, { error: "单次最多导入 500 个图标" });
    return;
  }
  if (!registry && !githubUrl) {
    json(400, { error: "缺少 registry 或 url 参数" });
    return;
  }

  const source = resolveSource(registry ?? null, variant, githubUrl ?? null);
  if ("error" in source) {
    json(400, { error: source.error });
    return;
  }

  // DB setup
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db, platform);
  const { projects, icons, user } = await import("~/lib/schema");
  const { eq, count } = await import("drizzle-orm");
  const { getQuota } = await import("~/lib/quota");

  // Quota check
  const userRows = await db
    .select({ plan: user.plan })
    .from(user)
    .where(eq(user.id, session.user.id));
  const plan = userRows[0]?.plan ?? "free";
  const quota = getQuota(plan);

  if (quota.maxProjects !== Infinity) {
    const [{ count: pc }] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.user_id, session.user.id));
    if ((pc ?? 0) >= quota.maxProjects) {
      json(403, {
        error: `项目数量已达上限 (${quota.maxProjects})，请升级 Pro 计划`,
      });
      return;
    }
  }

  // Create project (public visibility for imported icon libraries)
  const fontFamily =
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "iconfont";

  const [proj] = await db
    .insert(projects)
    .values({
      user_id: session.user.id,
      name: projectName.trim(),
      description: `从 ${source.label} 导入（${iconNames.length} 个图标）`,
      font_family: fontFamily,
      prefix: "icon-",
      visibility: "public",
    })
    .returning({ id: projects.id });

  const projectId = proj.id;
  const baseRaw = rawGitHubUrl(source.repo, source.branch, source.path);

  const token = (platform as any)?.env?.GITHUB_TOKEN as string | undefined;
  const fetchHeaders: Record<string, string> = {
    "User-Agent": "qwik-iconfont/1.0",
  };
  if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;

  const { uploadSVG } = await import("~/lib/storage");

  // Fetch + store SVGs concurrently in batches of 15
  const BATCH = 15;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < iconNames.length; i += BATCH) {
    const batch = iconNames.slice(i, i + BATCH);

    type IconRow = {
      project_id: number;
      name: string;
      svg_path: string;
      view_box: string;
      content: string;
      sort_order: number;
    };
    const rows: IconRow[] = [];

    const results = await Promise.allSettled(
      batch.map(async (name, idx) => {
        const svgUrl = `${baseRaw}/${name}.svg`;
        const res = await fetch(svgUrl, { headers: fetchHeaders });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const content = await res.text();

        const svgPath = await uploadSVG(platform, projectId, name, content);
        const viewBox = extractSvgViewBox(content) ?? DEFAULT_VIEW_BOX;

        rows.push({
          project_id: projectId,
          name,
          svg_path: svgPath,
          view_box: viewBox,
          content,
          sort_order: i + idx,
        });
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") imported++;
      else failed++;
    }

    if (rows.length > 0) {
      // Sub-batch inserts to stay within D1 parameter limits
      const SUB = 50;
      for (let j = 0; j < rows.length; j += SUB) {
        await db.insert(icons).values(rows.slice(j, j + SUB));
      }
    }
  }

  json(200, { projectId, imported, failed });
};
