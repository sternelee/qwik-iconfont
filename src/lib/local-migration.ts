/**
 * Migrates localStorage projects/icons to the server after authentication.
 * Tracks per-project success so only fully-migrated projects are removed locally.
 */
export async function migrateLocalProjects(): Promise<void> {
  try {
    const raw = localStorage.getItem("iconfont_projects");
    if (!raw) return;
    const projects = JSON.parse(raw);
    if (!Array.isArray(projects) || projects.length === 0) return;

    const migratedIds: string[] = [];

    for (const project of projects) {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: project.name,
            description: project.description,
            font_family: project.font_family,
            prefix: project.prefix,
          }),
        });
        if (!res.ok) continue;
        const { id: newProjectId } = (await res.json()) as { id: number };

        const iconsRaw = localStorage.getItem(`iconfont_icons_${project.id}`);
        if (iconsRaw) {
          const icons = JSON.parse(iconsRaw);
          if (Array.isArray(icons)) {
            for (const icon of icons) {
              const formData = new FormData();
              formData.append("name", icon.name);
              formData.append("content", icon.content);
              if (icon.unicode) formData.append("unicode", icon.unicode);
              if (icon.tags) formData.append("tags", icon.tags);
              await fetch(`/api/projects/${newProjectId}/icons`, {
                method: "POST",
                body: formData,
              });
            }
          }
        }

        migratedIds.push(String(project.id));
      } catch {
        /* Continue to next project on failure */
      }
    }

    if (migratedIds.length === 0) return;

    const remaining = projects.filter(
      (p: any) => !migratedIds.includes(String(p.id)),
    );
    if (remaining.length === 0) {
      localStorage.removeItem("iconfont_projects");
    } else {
      localStorage.setItem("iconfont_projects", JSON.stringify(remaining));
    }
    for (const id of migratedIds) {
      localStorage.removeItem(`iconfont_icons_${id}`);
    }
  } catch {
    /* Silent fail */
  }
}
