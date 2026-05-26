import type { Project, Icon } from "./types";

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

// In-memory mock for local dev when D1 is not available
class MockDB implements D1Database {
  private projects: Project[] = [];
  private icons: Icon[] = [];
  private projectId = 1;
  private iconId = 1;

  prepare(query: string): D1PreparedStatement {
    const params: unknown[] = [];
    const self = this;
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        params.push(...values);
        return stmt;
      },
      async first() {
        const m = query.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
        if (!m) return null;
        const table = m[2];
        const where = m[3];
        const items = table === "projects" ? self.projects : self.icons;
        if (where) {
          const w = where.replace(/\?/g, () => JSON.stringify(params.shift()));
          const idMatch = w.match(/id\s*=\s*(\d+)/);
          if (idMatch) {
            return (items as any[]).find((i: any) => i.id === +idMatch[1]) ?? null;
          }
        }
        return (items as any[])[0] ?? null;
      },
      async run() {
        const insertMatch = query.match(/INSERT\s+INTO\s+(\w+)\s+\(([^)]+)\)\s+VALUES\s+\(([^)]+)\)/i);
        if (insertMatch) {
          const table = insertMatch[1];
          const cols = insertMatch[2].split(",").map((c) => c.trim());
          const values = [...params];
          const obj: any = {};
          cols.forEach((col, i) => {
            obj[col] = values[i];
          });
          if (table === "projects") {
            obj.id = self.projectId++;
            obj.created_at = new Date().toISOString();
            obj.updated_at = new Date().toISOString();
            self.projects.push(obj);
            return { success: true, meta: { duration: 0, last_row_id: obj.id } };
          }
          if (table === "icons") {
            obj.id = self.iconId++;
            obj.created_at = new Date().toISOString();
            obj.updated_at = new Date().toISOString();
            self.icons.push(obj);
            return { success: true, meta: { duration: 0, last_row_id: obj.id } };
          }
        }
        const updateMatch = query.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+id\s*=\s*\?/i);
        if (updateMatch) {
          const table = updateMatch[1];
          const setClause = updateMatch[2];
          const id = params.pop() as number;
          const items = table === "projects" ? self.projects : self.icons;
          const item = (items as any[]).find((i: any) => i.id === id);
          if (item) {
            const sets = setClause.split(",").map((s) => s.trim());
            const vals = [...params];
            sets.forEach((s, i) => {
              const [col] = s.split("=");
              (item as any)[col.trim()] = vals[i];
            });
            (item as any).updated_at = new Date().toISOString();
          }
          return { success: true, meta: { duration: 0, changes: 1 } };
        }
        const deleteMatch = query.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);
        if (deleteMatch) {
          const table = deleteMatch[1];
          const where = deleteMatch[2];
          const items = table === "projects" ? self.projects : self.icons;
          const w = where.replace(/\?/g, () => JSON.stringify(params.shift()));
          const idMatch = w.match(/id\s*=\s*(\d+)/);
          if (idMatch) {
            const id = +idMatch[1];
            const idx = (items as any[]).findIndex((i: any) => i.id === id);
            if (idx >= 0) {
              items.splice(idx, 1);
              if (table === "projects") {
                self.icons = self.icons.filter((i) => i.project_id !== id);
              }
            }
          }
          return { success: true, meta: { duration: 0, changes: 1 } };
        }
        return { success: true, meta: { duration: 0 } };
      },
      async all() {
        const m = query.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+))?/i);
        if (!m) return { results: [], success: true };
        const table = m[2];
        const where = m[3];
        let items: any[] = table === "projects" ? [...self.projects] : [...self.icons];
        if (where) {
          const w = where.replace(/\?/g, () => JSON.stringify(params.shift()));
          const projectMatch = w.match(/project_id\s*=\s*(\d+)/);
          if (projectMatch) {
            items = items.filter((i: any) => i.project_id === +projectMatch[1]);
          }
          const idMatch = w.match(/id\s*=\s*(\d+)/);
          if (idMatch) {
            items = items.filter((i: any) => i.id === +idMatch[1]);
          }
        }
        if (m[4]) {
          items.sort((a: any, b: any) => {
            const col = m[4].trim().split(/\s+/)[0];
            return (a[col] ?? "").localeCompare(b[col] ?? "");
          });
        }
        return { results: items, success: true };
      },
      async raw() {
        const r = await stmt.all();
        return (r.results ?? []).map((row: any) => Object.values(row)) as any;
      },
    };
    return stmt;
  }

  batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return Promise.all(statements.map((s) => s.run()));
  }

  exec(query: string): Promise<D1ExecResult> {
    return Promise.resolve({ count: 0, duration: 0 });
  }
}

let mockDb: MockDB | null = null;

export function getDB(platform: any): D1Database {
  if (platform?.env?.DB) {
    return platform.env.DB as D1Database;
  }
  if (!mockDb) {
    mockDb = new MockDB();
  }
  return mockDb;
}

export async function initDB(db: D1Database) {
  const schema = `
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      font_family TEXT NOT NULL DEFAULT 'iconfont',
      prefix TEXT NOT NULL DEFAULT 'icon-',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS icons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      unicode TEXT,
      svg_path TEXT NOT NULL,
      view_box TEXT DEFAULT '0 0 1024 1024',
      width INTEGER,
      height INTEGER,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_icons_project ON icons(project_id);
    CREATE INDEX IF NOT EXISTS idx_icons_unicode ON icons(unicode);
  `;
  for (const stmt of schema.split(";").filter((s) => s.trim())) {
    await db.exec(stmt);
  }
}
