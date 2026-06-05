import type { RequestHandler } from "@builder.io/qwik-city";

// ── GET /api/icons/search?q=<name-or-tag>[&limit=N] ──────────────────────────
// Returns icons whose `name` or `tags` match the query, joined with their
// parent public project. Logged-in callers additionally see icons from
// their own private projects. Results are ordered to surface the most
// likely matches first: short names + project popularity.
//
// Note: we use `leftJoin` for both projects and user (rather than
// `innerJoin` on projects) so the dev-mode `MockExecutor` regex (which
// only matches `LEFT\s+JOIN`) can parse the SQL. The WHERE visibility
// filter still eliminates rows whose project is missing/invisible, so
// semantics are equivalent in production (D1/SQLite).

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const onGet: RequestHandler = async ({
  url,
  json,
  platform,
  request,
}) => {
  // `+` is a form-encoded space; the URL parser already decodes it but
  // we re-normalize defensively in case a hand-typed URL sneaks one in.
  const q = (url.searchParams.get("q") ?? "").replace(/\+/g, " ").trim();
  if (!q) {
    json(400, { error: "缺少 q 参数" });
    return;
  }
  if (q.length > 100) {
    json(400, { error: "q 参数过长" });
    return;
  }

  const limitParam = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Math.min(
    isNaN(limitParam) || limitParam <= 0 ? DEFAULT_LIMIT : limitParam,
    MAX_LIMIT,
  );

  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db, platform);
  const { icons, projects, user } = await import("~/lib/schema");
  const { eq, and, or, like, sql, asc, desc } = await import("drizzle-orm");
  const { getSessionFromRequest } = await import("~/lib/session");
  const session = await getSessionFromRequest(platform, request);

  // Note: `LIKE` treats `%` and `_` as wildcards. drizzle-orm's `like()`
  // doesn't expose an ESCAPE clause, so we accept that queries containing
  // those characters act as patterns. Single-quote injection is prevented
  // by parameterized binding.
  const pattern = `%${q}%`;

  // Visibility: public projects visible to everyone; logged-in callers also
  // see their own private projects' icons.
  const visibility = session
    ? or(
        eq(projects.visibility, "public"),
        eq(projects.user_id, session.user.id),
      )
    : eq(projects.visibility, "public");

  // Match on name OR tags. We OR them in the same WHERE to keep one index scan.
  const match = or(like(icons.name, pattern), like(icons.tags, pattern));
  const where = and(match, visibility);

  const rows = await db
    .select({
      id: icons.id,
      name: icons.name,
      unicode: icons.unicode,
      tags: icons.tags,
      view_box: icons.view_box,
      content: icons.content,
      // Compact parent project for context
      project_id: projects.id,
      project_name: projects.name,
      project_font_family: projects.font_family,
      project_visibility: projects.visibility,
      project_favorites_count: projects.favorites_count,
      author_name: user.name,
    })
    .from(icons)
    .leftJoin(projects, eq(icons.project_id, projects.id))
    .leftJoin(user, eq(projects.user_id, user.id))
    .where(where)
    // Shorter names rank first (more specific matches), tiebreak on project
    // popularity, then alphabetical for stability.
    .orderBy(
      asc(sql`length(${icons.name})`),
      desc(projects.favorites_count),
      asc(icons.name),
    )
    .limit(limit);

  json(200, {
    q,
    limit,
    icons: rows,
  });
};
