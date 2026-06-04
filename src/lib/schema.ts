import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ── better-auth tables ──────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  plan: text("plan").default("free"), // 'free' | 'pro'
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: text("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: text("accessTokenExpiresAt"),
  refreshTokenExpiresAt: text("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`),
});

// ── better-auth relations ───────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// ── app tables ──────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  user_id: text("user_id"), // null = anonymous project (localStorage fallback)
  name: text("name").notNull(),
  description: text("description"),
  font_family: text("font_family").notNull().default("iconfont"),
  prefix: text("prefix").notNull().default("icon-"),
  visibility: text("visibility").notNull().default("private"), // 'private' | 'public'
  source_url: text("source_url"), // canonical key for dedupe (e.g. owner/repo/branch/path) — used by GitHub import
  favorites_count: integer("favorites_count", { mode: "number" })
    .notNull()
    .default(0),
  views_count: integer("views_count", { mode: "number" }).notNull().default(0),
  downloads_count: integer("downloads_count", { mode: "number" })
    .notNull()
    .default(0),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const icons = sqliteTable("icons", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  project_id: integer("project_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  unicode: text("unicode"),
  svg_path: text("svg_path").notNull(),
  view_box: text("view_box").default("0 0 1024 1024"),
  width: integer("width", { mode: "number" }),
  height: integer("height", { mode: "number" }),
  content: text("content"),
  tags: text("tags"), // Comma-separated tags for categorization
  color_layers: text("color_layers"), // JSON: StoredColorLayer[] for COLRv0 coloured glyphs
  sort_order: integer("sort_order", { mode: "number" }).default(0),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const projectsRelations = relations(projects, ({ many, one }) => ({
  icons: many(icons),
  owner: one(user, {
    fields: [projects.user_id],
    references: [user.id],
  }),
}));

export const favorites = sqliteTable("favorites", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull(),
  project_id: integer("project_id", { mode: "number" }).notNull(),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const favoritesRelations = relations(favorites, ({ one }) => ({
  project: one(projects, {
    fields: [favorites.project_id],
    references: [projects.id],
  }),
}));

export const iconsRelations = relations(icons, ({ one }) => ({
  project: one(projects, {
    fields: [icons.project_id],
    references: [projects.id],
  }),
}));

export const apiTokens = sqliteTable("api_tokens", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull(),
  name: text("name").notNull(),
  token_hash: text("token_hash").notNull().unique(),
  last_used_at: text("last_used_at"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const projectMembers = sqliteTable("project_members", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  project_id: integer("project_id", { mode: "number" }).notNull(),
  user_id: text("user_id").notNull(),
  role: text("role").notNull().default("editor"), // 'editor' | 'viewer'
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const webhooks = sqliteTable("webhooks", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull(),
  project_id: integer("project_id", { mode: "number" }).notNull(),
  url: text("url").notNull(),
  events: text("events").notNull().default("*"), // comma-separated, e.g. "icon.created,icon.deleted"
  secret: text("secret"), // for HMAC signature
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
