import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export const projects = sqliteTable("projects", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  font_family: text("font_family").notNull().default("iconfont"),
  prefix: text("prefix").notNull().default("icon-"),
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
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  icons: many(icons),
}));

export const iconsRelations = relations(icons, ({ one }) => ({
  project: one(projects, {
    fields: [icons.project_id],
    references: [projects.id],
  }),
}));