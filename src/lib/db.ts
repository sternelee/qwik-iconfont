import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

function parseColumns(selectPart: string): string[] {
  const cols: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of selectPart) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      cols.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) cols.push(current.trim());
  return cols;
}

function extractAlias(colExpr: string): string {
  const asMatch = colExpr.match(/as\s+"?([^"]+)"?$/i);
  if (asMatch) return asMatch[1];
  // Handle "table"."column" → return "column"
  const tableColMatch = colExpr.match(/"?\w+"?\."?([^"]+)"?$/);
  if (tableColMatch) return tableColMatch[1];
  // Handle single "column"
  const quoteMatch = colExpr.match(/"([^"]+)"/);
  if (quoteMatch) return quoteMatch[1];
  return colExpr.trim();
}

/** Extract ordered column aliases from SELECT or RETURNING clause */
function extractResultColumns(sql: string): string[] {
  let colsPart: string | null = null;

  // SELECT col1, col2 FROM ...
  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s/i);
  if (selectMatch) {
    colsPart = selectMatch[1];
  }

  // INSERT ... RETURNING col1, col2
  const returningMatch = sql.match(/RETURNING\s+(.+)$/i);
  if (returningMatch) {
    colsPart = returningMatch[1];
  }

  if (!colsPart) return [];
  return parseColumns(colsPart).map(extractAlias);
}

class MockExecutor {
  private projects: any[] = [];
  private icons: any[] = [];
  private nextProjectId = 1;
  private nextIconId = 1;

  async execute(
    sql: string,
    params: any[],
    method: string,
  ): Promise<{ rows: any[] }> {
    const lower = sql.trim().toLowerCase();
    let results: any[] = [];

    if (lower.startsWith("select")) {
      results = this.select(sql, [...params]);
    } else if (lower.startsWith("insert")) {
      results = this.insert(sql, [...params]);
    } else if (lower.startsWith("update")) {
      results = this.update(sql, [...params]);
    } else if (lower.startsWith("delete")) {
      results = this.delete(sql, [...params]);
    }

    // Drizzle ORM sqlite-proxy expects array-of-arrays for "all"/"get"/"values"
    if (method === "all" || method === "get" || method === "values") {
      const columns = extractResultColumns(sql);
      if (columns.length > 0) {
        const arrayResults = results.map((row) =>
          columns.map((col) => (row[col] !== undefined ? row[col] : null)),
        );
        if (method === "get") {
          return { rows: arrayResults[0] ?? [] };
        }
        return { rows: arrayResults };
      }
    }

    return { rows: results };
  }

  private select(sql: string, params: any[]): any[] {
    const fromMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+"?(\w+)"?\s*/i);
    if (!fromMatch) return [];
    const colsExpr = fromMatch[1];
    const table = fromMatch[2];

    const whereMatch = sql.match(
      /WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|$)/i,
    );
    const whereClause = whereMatch ? whereMatch[1] : null;

    const joinMatch = sql.match(
      /LEFT\s+JOIN\s+"?(\w+)"?\s+ON\s+(.+?)(?:\s+WHERE|\s+GROUP\s+BY|\s+ORDER\s+BY|$)/i,
    );

    const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)$/i);

    let items: any[] =
      table === "projects" ? [...this.projects] : [...this.icons];

    // Apply WHERE
    if (whereClause) {
      items = items.filter((item) =>
        this.matchesWhere(whereClause, item, params),
      );
    }

    // Handle JOIN
    let results: any[] = [];
    if (joinMatch) {
      const joinTable = joinMatch[1];
      const joinItems =
        joinTable === "icons" ? [...this.icons] : [...this.projects];
      const joinColExpr = joinMatch[2];
      const joinParts = joinColExpr.match(
        /"?\w+"?\."?(\w+)"?\s*=\s*"?(\w+)"?\."?(\w+)"?/,
      );

      for (const item of items) {
        const joined = joinItems.filter((j) => {
          if (!joinParts) return false;
          return item[joinParts[1]] === j[joinParts[3]];
        });
        const cols = parseColumns(colsExpr);
        const row: any = {};
        for (const col of cols) {
          const alias = extractAlias(col);
          if (col.toLowerCase().includes("count(")) {
            row[alias] = joined.length;
          } else if (col.includes(".")) {
            const parts = col.match(/"?\w+"?\."?(\w+)"?/);
            if (parts) {
              const tableName = col.match(/"?(\w+)"?\./)?.[1];
              if (tableName === table) {
                row[alias] = item[parts[1]];
              } else {
                row[alias] = joined[0]?.[parts[1]] ?? null;
              }
            }
          } else {
            row[alias] = item[alias];
          }
        }
        results.push(row);
      }
    } else {
      const cols = parseColumns(colsExpr);
      for (const item of items) {
        const row: any = {};
        for (const col of cols) {
          const alias = extractAlias(col);
          if (col.includes(".")) {
            const parts = col.match(/"?\w+"?\."?(\w+)"?/);
            if (parts) {
              row[alias] = item[parts[1]];
            }
          } else {
            row[alias] = item[alias];
          }
        }
        results.push(row);
      }
    }

    // Apply ORDER BY
    if (orderMatch) {
      const orderExpr = orderMatch[1];
      const desc = orderExpr.toLowerCase().includes("desc");
      const colMatch = orderExpr.match(/"?\w+"?\."?(\w+)"?/);
      if (colMatch) {
        const col = colMatch[1];
        results.sort((a, b) => {
          const av = a[col] ?? "";
          const bv = b[col] ?? "";
          const cmp = String(av).localeCompare(String(bv));
          return desc ? -cmp : cmp;
        });
      }
    }

    return results;
  }

  private matchesWhere(whereClause: string, item: any, params: any[]): boolean {
    // "projects"."id" = ?
    const eqMatch = whereClause.match(/"?\w+"?\."?(\w+)"?\s*=\s*\?/);
    if (eqMatch) {
      const col = eqMatch[1];
      const val = params.shift();
      return item[col] === val;
    }
    // "icons"."id" IN (?, ?, ...)
    const inMatch = whereClause.match(/"?\w+"?\."?(\w+)"?\s+IN\s+\(([^)]+)\)/);
    if (inMatch) {
      const col = inMatch[1];
      const count = inMatch[2].split(",").length;
      const vals = params.splice(0, count);
      return vals.includes(item[col]);
    }
    return true;
  }

  private insert(sql: string, params: any[]): any[] {
    const match = sql.match(
      /INSERT\s+INTO\s+"?(\w+)"?\s+\(([^)]+)\)\s+VALUES\s+\(([^)]+)\)(?:\s+RETURNING\s+(.+))?/i,
    );
    if (!match) return [];
    const table = match[1];
    const cols = match[2].split(",").map((c) => c.trim().replace(/"/g, ""));
    const rawValues = this.splitValues(match[3]);
    const paramQueue = [...params];
    const obj: any = {};
    cols.forEach((col, i) => {
      const valExpr = rawValues[i]?.trim().toLowerCase();
      if (valExpr === "?") {
        obj[col] = paramQueue.shift();
      } else if (valExpr === "null") {
        obj[col] = null;
      } else if (valExpr === "current_timestamp") {
        obj[col] = new Date().toISOString();
      } else if (valExpr === "true") {
        obj[col] = true;
      } else if (valExpr === "false") {
        obj[col] = false;
      } else if (valExpr && !isNaN(Number(valExpr))) {
        obj[col] = Number(valExpr);
      } else if (valExpr?.startsWith("'") && valExpr?.endsWith("'")) {
        obj[col] = valExpr.slice(1, -1);
      } else {
        obj[col] = rawValues[i]?.trim() ?? null;
      }
    });

    if (table === "projects") {
      if (obj.id == null) obj.id = this.nextProjectId++;
      if (!obj.created_at) obj.created_at = new Date().toISOString();
      if (!obj.updated_at) obj.updated_at = new Date().toISOString();
      this.projects.push(obj);
      return [obj];
    }
    if (table === "icons") {
      if (obj.id == null) obj.id = this.nextIconId++;
      if (!obj.created_at) obj.created_at = new Date().toISOString();
      if (!obj.updated_at) obj.updated_at = new Date().toISOString();
      this.icons.push(obj);
      return [obj];
    }
    return [];
  }

  private splitValues(valuesExpr: string): string[] {
    const vals: string[] = [];
    let depth = 0;
    let current = "";
    for (const char of valuesExpr) {
      if (char === "(") depth++;
      else if (char === ")") depth--;
      else if (char === "," && depth === 0) {
        vals.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    if (current.trim()) vals.push(current.trim());
    return vals;
  }

  private update(sql: string, params: any[]): any[] {
    const match = sql.match(
      /UPDATE\s+"?(\w+)"?\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i,
    );
    if (!match) return [];
    const table = match[1];
    const setClause = match[2];
    const whereClause = match[3];
    const items = table === "projects" ? this.projects : this.icons;

    const idMatch = whereClause.match(/"?\w+"?\."?(\w+)"?\s*=\s*\?/);
    const id = params.pop();
    const item = items.find((i) => i[idMatch?.[1] ?? "id"] === id);
    if (!item) return [];

    const setParts = setClause.split(",").map((s) => s.trim());
    const vals = [...params];
    setParts.forEach((part, i) => {
      const colMatch = part.match(/"?\w+"?\s*=\s*\?/);
      if (colMatch) {
        const col = colMatch[0].match(/"?\w+"?/)?.[0].replace(/"/g, "") ?? "";
        item[col] = vals[i];
      }
    });
    item.updated_at = new Date().toISOString();

    return [{ changes: 1 }];
  }

  private delete(sql: string, params: any[]): any[] {
    const match = sql.match(/DELETE\s+FROM\s+"?(\w+)"?\s+WHERE\s+(.+)$/i);
    if (!match) return [];
    const table = match[1];
    const whereClause = match[2];
    const items = table === "projects" ? this.projects : this.icons;

    const idMatch = whereClause.match(/"?\w+"?\."?(\w+)"?\s*=\s*\?/);
    const id = params[0];
    const idx = items.findIndex((i) => i[idMatch?.[1] ?? "id"] === id);
    if (idx >= 0) {
      items.splice(idx, 1);
      if (table === "projects") {
        this.icons = this.icons.filter((i) => i.project_id !== id);
      }
    }
    return [{ changes: 1 }];
  }
}

let mockExecutor: MockExecutor | null = null;

function getMockExecutor(): MockExecutor {
  if (!mockExecutor) {
    mockExecutor = new MockExecutor();
  }
  return mockExecutor;
}

export type AppDatabase = BaseSQLiteDatabase<"async", any, typeof schema>;

/** D1 does not accept Date objects as bind parameters.
 *  better-auth generates `new Date()` for timestamps, so we wrap D1
 *  to convert Date → ISO string before binding. */
function wrapD1(d1: any): any {
  const origPrepare = d1.prepare.bind(d1);
  const wrapStmt = (stmt: any): any => {
    const origBind = stmt.bind.bind(stmt);
    return new Proxy(stmt, {
      get(target, prop, receiver) {
        if (prop === "bind") {
          return function (...params: any[]) {
            const fixed = params.map((p) =>
              p instanceof Date ? p.toISOString() : p,
            );
            return wrapStmt(origBind(...fixed));
          };
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === "function" ? val.bind(target) : val;
      },
    });
  };
  return new Proxy(d1, {
    get(target, prop, receiver) {
      if (prop === "prepare") {
        return function (sql: string) {
          return wrapStmt(origPrepare(sql));
        };
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

export function getDB(platform: any): AppDatabase {
  if (platform?.env?.DB) {
    return drizzleD1(wrapD1(platform.env.DB), {
      schema,
    }) as AppDatabase;
  }
  const executor = getMockExecutor();
  return drizzleProxy(
    async (sql, params, method) => {
      return executor.execute(sql, params, method);
    },
    { schema },
  ) as AppDatabase;
}

export async function initDB(_db: AppDatabase, platform?: any) {
  // Auto-create tables on D1 as a fallback when migrations haven't been applied
  if (platform?.env?.DB) {
    const d1 = platform.env.DB;
    try {
      await d1.exec(
        // better-auth tables
        `CREATE TABLE IF NOT EXISTS "user" (` +
          `id TEXT PRIMARY KEY NOT NULL, ` +
          `name TEXT NOT NULL, ` +
          `email TEXT NOT NULL UNIQUE, ` +
          `emailVerified INTEGER NOT NULL DEFAULT 0, ` +
          `image TEXT, ` +
          `plan TEXT DEFAULT 'free', ` +
          `createdAt TEXT DEFAULT CURRENT_TIMESTAMP, ` +
          `updatedAt TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);` +
          `CREATE TABLE IF NOT EXISTS "session" (` +
          `id TEXT PRIMARY KEY NOT NULL, ` +
          `expiresAt TEXT NOT NULL, ` +
          `token TEXT NOT NULL UNIQUE, ` +
          `createdAt TEXT DEFAULT CURRENT_TIMESTAMP, ` +
          `updatedAt TEXT DEFAULT CURRENT_TIMESTAMP, ` +
          `ipAddress TEXT, ` +
          `userAgent TEXT, ` +
          `userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE` +
          `);` +
          `CREATE TABLE IF NOT EXISTS "account" (` +
          `id TEXT PRIMARY KEY NOT NULL, ` +
          `accountId TEXT NOT NULL, ` +
          `providerId TEXT NOT NULL, ` +
          `userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, ` +
          `accessToken TEXT, ` +
          `refreshToken TEXT, ` +
          `idToken TEXT, ` +
          `accessTokenExpiresAt TEXT, ` +
          `refreshTokenExpiresAt TEXT, ` +
          `scope TEXT, ` +
          `password TEXT, ` +
          `createdAt TEXT DEFAULT CURRENT_TIMESTAMP, ` +
          `updatedAt TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);` +
          `CREATE TABLE IF NOT EXISTS "verification" (` +
          `id TEXT PRIMARY KEY NOT NULL, ` +
          `identifier TEXT NOT NULL, ` +
          `value TEXT NOT NULL, ` +
          `expiresAt TEXT NOT NULL, ` +
          `createdAt TEXT DEFAULT CURRENT_TIMESTAMP, ` +
          `updatedAt TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);` +
          // app tables
          `CREATE TABLE IF NOT EXISTS projects (` +
          `id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
          `user_id TEXT, ` +
          `name TEXT NOT NULL, ` +
          `description TEXT, ` +
          `font_family TEXT DEFAULT 'iconfont' NOT NULL, ` +
          `prefix TEXT DEFAULT 'icon-' NOT NULL, ` +
          `visibility TEXT DEFAULT 'private' NOT NULL, ` +
          `source_url TEXT, ` +
          `favorites_count INTEGER DEFAULT 0 NOT NULL, ` +
          `views_count INTEGER DEFAULT 0 NOT NULL, ` +
          `downloads_count INTEGER DEFAULT 0 NOT NULL, ` +
          `created_at TEXT DEFAULT CURRENT_TIMESTAMP, ` +
          `updated_at TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);` +
          `CREATE TABLE IF NOT EXISTS icons (` +
          `id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
          `project_id INTEGER NOT NULL, ` +
          `name TEXT NOT NULL, ` +
          `unicode TEXT, ` +
          `svg_path TEXT NOT NULL, ` +
          `view_box TEXT DEFAULT '0 0 1024 1024', ` +
          `width INTEGER, ` +
          `height INTEGER, ` +
          `content TEXT, ` +
          `tags TEXT, ` +
          `sort_order INTEGER DEFAULT 0, ` +
          `created_at TEXT DEFAULT CURRENT_TIMESTAMP, ` +
          `updated_at TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);` +
          `CREATE TABLE IF NOT EXISTS favorites (` +
          `id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
          `user_id TEXT NOT NULL, ` +
          `project_id INTEGER NOT NULL, ` +
          `created_at TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);` +
          `CREATE TABLE IF NOT EXISTS api_tokens (` +
          `id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
          `user_id TEXT NOT NULL, ` +
          `name TEXT NOT NULL, ` +
          `token_hash TEXT NOT NULL UNIQUE, ` +
          `last_used_at TEXT, ` +
          `created_at TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);` +
          `CREATE TABLE IF NOT EXISTS project_members (` +
          `id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
          `project_id INTEGER NOT NULL, ` +
          `user_id TEXT NOT NULL, ` +
          `role TEXT DEFAULT 'editor' NOT NULL, ` +
          `created_at TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);` +
          `CREATE TABLE IF NOT EXISTS webhooks (` +
          `id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ` +
          `user_id TEXT NOT NULL, ` +
          `project_id INTEGER NOT NULL, ` +
          `url TEXT NOT NULL, ` +
          `events TEXT DEFAULT '*' NOT NULL, ` +
          `secret TEXT, ` +
          `active INTEGER DEFAULT 1 NOT NULL, ` +
          `created_at TEXT DEFAULT CURRENT_TIMESTAMP` +
          `);`,
      );
      // Add user_id column if it doesn't exist (migration for existing databases)
      try {
        await d1.exec(`ALTER TABLE projects ADD COLUMN user_id TEXT`);
      } catch {
        // Column may already exist
      }
      // Add visibility column if it doesn't exist
      try {
        await d1.exec(
          `ALTER TABLE projects ADD COLUMN visibility TEXT DEFAULT 'private'`,
        );
      } catch {
        // Column may already exist
      }
      // Add favorites_count column if it doesn't exist
      try {
        await d1.exec(
          `ALTER TABLE projects ADD COLUMN favorites_count INTEGER DEFAULT 0`,
        );
      } catch {
        // Column may already exist
      }
      // Add sort_order column if it doesn't exist
      try {
        await d1.exec(
          `ALTER TABLE icons ADD COLUMN sort_order INTEGER DEFAULT 0`,
        );
      } catch {
        /* Column may already exist */
      }
      // Add views_count column if it doesn't exist
      try {
        await d1.exec(
          `ALTER TABLE projects ADD COLUMN views_count INTEGER DEFAULT 0`,
        );
      } catch {
        /* Column may already exist */
      }
      // Add downloads_count column if it doesn't exist
      try {
        await d1.exec(
          `ALTER TABLE projects ADD COLUMN downloads_count INTEGER DEFAULT 0`,
        );
      } catch {
        /* Column may already exist */
      }
      // Add plan column if it doesn't exist
      try {
        await d1.exec(`ALTER TABLE "user" ADD COLUMN plan TEXT DEFAULT 'free'`);
      } catch {
        /* Column may already exist */
      }
      // Add tags column if it doesn't exist
      try {
        await d1.exec(`ALTER TABLE icons ADD COLUMN tags TEXT`);
      } catch {
        // Column may already exist
      }
      // Add color_layers column if it doesn't exist
      try {
        await d1.exec(`ALTER TABLE icons ADD COLUMN color_layers TEXT`);
      } catch {
        /* Column may already exist */
      }
      // Add source_url column if it doesn't exist (GitHub import dedupe)
      try {
        await d1.exec(`ALTER TABLE projects ADD COLUMN source_url TEXT`);
      } catch {
        /* Column may already exist */
      }
    } catch {
      // Tables may already exist or migrations have been applied; ignore errors
    }
  }
}
