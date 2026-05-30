/**
 * LocalStorage abstraction for anonymous user projects.
 * Used when user is not authenticated — all data stays in the browser.
 */

export interface LocalProject {
  id: number;
  name: string;
  description: string | null;
  font_family: string;
  prefix: string;
  icon_count: number;
  created_at: string;
  updated_at: string;
}

export interface LocalIcon {
  id: number;
  project_id: number;
  name: string;
  unicode: string | null;
  svg_path: string;
  view_box: string | null;
  width: number | null;
  height: number | null;
  content: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

const PROJECTS_KEY = "iconfont_projects";
const ICONS_PREFIX = "iconfont_icons_";
const NEXT_ID_KEY = "iconfont_next_id";

function getNextId(): number {
  const raw = localStorage.getItem(NEXT_ID_KEY);
  const id = raw ? parseInt(raw, 10) : 1;
  localStorage.setItem(NEXT_ID_KEY, String(id + 1));
  return id;
}

// ── Projects ────────────────────────────────────────────────────────

export function getLocalProjects(): LocalProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const projects = JSON.parse(raw);
    return Array.isArray(projects) ? projects : [];
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects: LocalProject[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function createLocalProject(params: {
  name: string;
  description?: string;
  font_family?: string;
  prefix?: string;
}): LocalProject {
  const now = new Date().toISOString();
  const project: LocalProject = {
    id: getNextId(),
    name: params.name,
    description: params.description || null,
    font_family: params.font_family || "iconfont",
    prefix: params.prefix || "icon-",
    icon_count: 0,
    created_at: now,
    updated_at: now,
  };

  const projects = getLocalProjects();
  projects.unshift(project);
  saveLocalProjects(projects);
  return project;
}

export function deleteLocalProject(id: number): void {
  const projects = getLocalProjects().filter((p) => p.id !== id);
  saveLocalProjects(projects);
  // Also delete icons
  localStorage.removeItem(`${ICONS_PREFIX}${id}`);
}

export function getLocalProject(id: number): LocalProject | null {
  return getLocalProjects().find((p) => p.id === id) || null;
}

export function updateLocalProject(
  id: number,
  updates: Partial<
    Pick<LocalProject, "name" | "description" | "font_family" | "prefix">
  >,
): LocalProject | null {
  const projects = getLocalProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  projects[idx] = {
    ...projects[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  saveLocalProjects(projects);
  return projects[idx];
}

// ── Icons ───────────────────────────────────────────────────────────

export function getLocalIcons(projectId: number): LocalIcon[] {
  try {
    const raw = localStorage.getItem(`${ICONS_PREFIX}${projectId}`);
    if (!raw) return [];
    const icons = JSON.parse(raw);
    return Array.isArray(icons) ? icons : [];
  } catch {
    return [];
  }
}

export function saveLocalIcons(projectId: number, icons: LocalIcon[]): void {
  localStorage.setItem(`${ICONS_PREFIX}${projectId}`, JSON.stringify(icons));
  // Update icon count on project
  const projects = getLocalProjects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx !== -1) {
    projects[idx].icon_count = icons.length;
    projects[idx].updated_at = new Date().toISOString();
    saveLocalProjects(projects);
  }
}

export function createLocalIcon(
  projectId: number,
  params: {
    name: string;
    content: string;
    unicode?: string;
    tags?: string;
  },
): LocalIcon {
  const now = new Date().toISOString();
  const icons = getLocalIcons(projectId);
  const icon: LocalIcon = {
    id: getNextId(),
    project_id: projectId,
    name: params.name,
    unicode: params.unicode || null,
    svg_path: `local/${projectId}/${params.name}.svg`,
    view_box: null,
    width: null,
    height: null,
    content: params.content,
    tags: params.tags || null,
    created_at: now,
    updated_at: now,
  };

  icons.push(icon);
  saveLocalIcons(projectId, icons);
  return icon;
}

export function deleteLocalIcon(projectId: number, iconId: number): void {
  const icons = getLocalIcons(projectId).filter((i) => i.id !== iconId);
  saveLocalIcons(projectId, icons);
}

export function updateLocalIcon(
  projectId: number,
  iconId: number,
  updates: Partial<
    Pick<LocalIcon, "name" | "unicode" | "content" | "tags" | "view_box">
  >,
): LocalIcon | null {
  const icons = getLocalIcons(projectId);
  const idx = icons.findIndex((i) => i.id === iconId);
  if (idx === -1) return null;

  icons[idx] = {
    ...icons[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  saveLocalIcons(projectId, icons);
  return icons[idx];
}
