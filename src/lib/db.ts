import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

// D1Database interface matching Cloudflare D1
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: { duration: number; changes?: number; last_row_id?: number };
  error?: string;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

function unquote(s: string): string {
  return s.replace(/^"|"$/g, "").replace(/"/g, "");
}

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
  const quoteMatch = colExpr.match(/"([^"]+)"/);
  if (quoteMatch) return quoteMatch[1];
  return colExpr.trim();
}

class MockExecutor {
  private projects: any[] = [];
  private icons: any[] = [];
  private nextProjectId = 1;
  private nextIconId = 1;

  async execute(
    sql: string,
    params: any[],
    _method: string,
  ): Promise<{ rows: any[] }> {
    const lower = sql.trim().toLowerCase();

    if (lower.startsWith("select")) {
      return { rows: this.select(sql, [...params]) };
    }
    if (lower.startsWith("insert")) {
      return { rows: this.insert(sql, [...params]) };
    }
    if (lower.startsWith("update")) {
      return { rows: this.update(sql, [...params]) };
    }
    if (lower.startsWith("delete")) {
      return { rows: this.delete(sql, [...params]) };
    }

    return { rows: [] };
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
    const inMatch = whereClause.match(
      /"?\w+"?\."?(\w+)"?\s+IN\s+\(([^)]+)\)/,
    );
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
    const cols = match[2]
      .split(",")
      .map((c) => c.trim().replace(/"/g, ""));
    const values = [...params];
    const obj: any = {};
    cols.forEach((col, i) => {
      obj[col] = values[i];
    });

    if (table === "projects") {
      obj.id = this.nextProjectId++;
      obj.created_at = new Date().toISOString();
      obj.updated_at = new Date().toISOString();
      this.projects.push(obj);
      return [obj];
    }
    if (table === "icons") {
      obj.id = this.nextIconId++;
      obj.created_at = new Date().toISOString();
      obj.updated_at = new Date().toISOString();
      this.icons.push(obj);
      return [obj];
    }
    return [];
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
        const col =
          colMatch[0].match(/"?\w+"?/)?.[0].replace(/"/g, "") ?? "";
        item[col] = vals[i];
      }
    });
    item.updated_at = new Date().toISOString();

    return [{ changes: 1 }];
  }

  private delete(sql: string, params: any[]): any[] {
    const match = sql.match(
      /DELETE\s+FROM\s+"?(\w+)"?\s+WHERE\s+(.+)$/i,
    );
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

export function getDB(platform: any): AppDatabase {
  if (platform?.env?.DB) {
    return drizzleD1(platform.env.DB as D1Database, {
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

export async function initDB(_db: AppDatabase) {
  // Schema is already ensured via drizzle migrations or init above
}
