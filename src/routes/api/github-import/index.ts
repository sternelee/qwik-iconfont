import type { RequestHandler } from "@builder.io/qwik-city";
import { parseGitHubUrl, rawGitHubUrl, canonicalSourceKey } from "~/lib/github-registry";
import { extractSvgViewBox, DEFAULT_VIEW_BOX } from "~/lib/types";

// ── Per-Worker in-memory cache ───────────────────────────────────────────────
const treeCache = new Map<string, { names: string[]; cachedAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

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
        !f.path.slice(prefix.length).includes("/"),
    )
    .map((f) => f.path.slice(prefix.length, -4));

  treeCache.set(key, { names, cachedAt: Date.now() });
  return names;
}

// ── GET /api/github-import?url=<github-tree-url>[&search=...] ────────────────
export const onGet: RequestHandler = async ({ url, json, platform, request }) => {
  const githubUrl = url.searchParams.get("url");
  const search = url.searchParams.get("search")?.toLowerCase().trim() ?? "";

  if (!githubUrl) {
    json(400, { error: "缺少 url 参数" });
    return;
  }

  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    json(400, { error: "无效的 GitHub URL，请粘贴仓库目录页面的完整 URL" });
    return;
  }

  const token = (platform as any)?.env?.GITHUB_TOKEN as string | undefined;

  try {
    let names = await fetchIconNames(
      parsed.repo,
      parsed.branch,
      parsed.path,
      token,
    );

    if (search) {
      names = names.filter((n) => n.toLowerCase().includes(search));
    }

    const baseRaw = rawGitHubUrl(parsed.repo, parsed.branch, parsed.path);

    // Dedupe check: find existing projects that were imported from the same source.
    // Returns public projects (anyone) + the caller's own private projects.
    let existingProjects: Array<{
      id: number;
      name: string;
      visibility: string;
      owner_name: string | null;
      icon_count: number;
      updated_at: string | null;
      is_owner: boolean;
    }> = [];
    try {
      const { getDB, initDB } = await import("~/lib/db");
      const { projects, icons, user } = await import("~/lib/schema");
      const { eq, and, or, count, desc } = await import("drizzle-orm");
      const { getSessionFromRequest } = await import("~/lib/session");
      const session = await getSessionFromRequest(platform, request);
      const sourceKey = canonicalSourceKey(parsed);
      const db = getDB(platform);
      await initDB(db, platform);

      const visibilityFilter = session
        ? or(eq(projects.visibility, "public"), eq(projects.user_id, session.user.id))
        : eq(projects.visibility, "public");

      const rows = await db
        .select({
          id: projects.id,
          name: projects.name,
          visibility: projects.visibility,
          user_id: projects.user_id,
          owner_name: user.name,
          updated_at: projects.updated_at,
          icon_count: count(icons.id),
        })
        .from(projects)
        .leftJoin(icons, eq(projects.id, icons.project_id))
        .leftJoin(user, eq(projects.user_id, user.id))
        .where(and(eq(projects.source_url, sourceKey), visibilityFilter))
        .groupBy(projects.id)
        .orderBy(desc(projects.id))
        .limit(20);

      existingProjects = rows.map((r) => ({
        id: r.id,
        name: r.name,
        visibility: r.visibility,
        owner_name: r.owner_name ?? null,
        icon_count: r.icon_count ?? 0,
        updated_at: r.updated_at ?? null,
        is_owner: !!(session && r.user_id === session.user.id),
      }));
    } catch {
      // Dedupe lookup is best-effort; never block listing
      existingProjects = [];
    }

    json(200, {
      repo: parsed.repo,
      branch: parsed.branch,
      path: parsed.path,
      label: parsed.label,
      total: names.length,
      icons: names.map((name) => ({
        name,
        previewUrl: `${baseRaw}/${name}.svg`,
      })),
      existingProjects,
    });
    return;
  } catch (err: any) {
    json(502, { error: err.message });
    return;
  }
};

// ── POST /api/github-import ───────────────────────────────────────────────────
// Body: { url, icons: string[], projectName }
export const onPost: RequestHandler = async ({ json, request, platform }) => {
  const { getSessionFromRequest } = await import("~/lib/session");
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "请先登录" });
    return;
  }

  const body = (await request.json()) as {
    url: string;
    icons: string[];
    projectName: string;
    force?: boolean;
  };

  const { url: githubUrl, icons: iconNames, projectName, force } = body;

  if (!githubUrl) {
    json(400, { error: "缺少 url 参数" });
    return;
  }
  if (!Array.isArray(iconNames) || iconNames.length === 0) {
    json(400, { error: "请至少选择一个图标" });
    return;
  }
  if (!projectName?.trim()) {
    json(400, { error: "请输入图标集名称" });
    return;
  }

  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    json(400, { error: "无效的 GitHub URL" });
    return;
  }

  // DB setup
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db, platform);
  const { projects, icons, user } = await import("~/lib/schema");
  const { eq, and, count } = await import("drizzle-orm");
  const { getQuota } = await import("~/lib/quota");

  // Dedupe check — refuse if this source was already imported by the current user.
  // Other users may still import the same public source. Caller can bypass with `force: true`
  // after UI confirmation (we surface the list so they can decide).
  const sourceKey = canonicalSourceKey(parsed);
  if (!force) {
    const dupes = await db
      .select({
        id: projects.id,
        name: projects.name,
        icon_count: count(icons.id),
      })
      .from(projects)
      .leftJoin(icons, eq(projects.id, icons.project_id))
      .where(
        and(
          eq(projects.source_url, sourceKey),
          eq(projects.user_id, session.user.id),
        ),
      )
      .groupBy(projects.id);
    if (dupes.length > 0) {
      json(409, {
        error: "DUPLICATE",
        message: "该 GitHub 源已被你导入过",
        existingProjects: dupes.map((r) => ({
          id: r.id,
          name: r.name,
          icon_count: r.icon_count ?? 0,
        })),
      });
      return;
    }
  }

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

  // Create project
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
      description: `从 ${parsed.label} 导入（${iconNames.length} 个图标）`,
      font_family: fontFamily,
      prefix: "icon-",
      visibility: "public",
      source_url: sourceKey,
    })
    .returning({ id: projects.id });

  const projectId = proj.id;
  const baseRaw = rawGitHubUrl(parsed.repo, parsed.branch, parsed.path);

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
      const SUB = 50;
      for (let j = 0; j < rows.length; j += SUB) {
        await db.insert(icons).values(rows.slice(j, j + SUB));
      }
    }
  }

  json(200, { projectId, imported, failed });
};
