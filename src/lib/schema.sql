-- Projects table: each project is an iconfont icon set
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  font_family TEXT NOT NULL DEFAULT 'iconfont',
  prefix TEXT NOT NULL DEFAULT 'icon-',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Icons table: individual SVG icons within a project
CREATE TABLE IF NOT EXISTS icons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  unicode TEXT,
  svg_path TEXT NOT NULL,         -- R2 key for the SVG file
  view_box TEXT DEFAULT '0 0 1024 1024',
  width INTEGER,
  height INTEGER,
  content TEXT,                   -- cached SVG content for quick access
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_icons_project ON icons(project_id);
CREATE INDEX IF NOT EXISTS idx_icons_unicode ON icons(unicode);
