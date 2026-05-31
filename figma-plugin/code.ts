// Figma Plugin — Export selected nodes as SVG to Iconfont

figma.showUI(__html__, { width: 360, height: 420 });

async function exportNode(
  node: SceneNode,
): Promise<{ name: string; svg: string } | null> {
  try {
    const bytes = await node.exportAsync({ format: "SVG" });
    const svg = new TextDecoder().decode(bytes);
    return { name: node.name, svg };
  } catch {
    return null;
  }
}

figma.ui.onmessage = async (msg: {
  type: string;
  token: string;
  projectId: string;
  baseUrl: string;
}) => {
  if (msg.type !== "export") return;

  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.ui.postMessage({ type: "error", message: "请先选中矢量节点" });
    return;
  }

  const results: { name: string; svg: string }[] = [];
  for (const node of selection) {
    const exported = await exportNode(node);
    if (exported) results.push(exported);
  }

  if (results.length === 0) {
    figma.ui.postMessage({ type: "error", message: "无法导出选中节点为 SVG" });
    return;
  }

  figma.ui.postMessage({ type: "progress", total: results.length, done: 0 });

  const baseUrl = msg.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/projects/${msg.projectId}/icons`;

  let success = 0;
  let failed = 0;

  for (const item of results) {
    try {
      const formData = new FormData();
      formData.append("name", item.name);
      formData.append("content", item.svg);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${msg.token}`,
        },
        body: formData,
      });

      if (res.ok) {
        success++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    figma.ui.postMessage({
      type: "progress",
      total: results.length,
      done: success + failed,
    });
  }

  figma.ui.postMessage({ type: "done", success, failed });
};
