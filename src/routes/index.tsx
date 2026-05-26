import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, useNavigate } from "@builder.io/qwik-city";
import type { Project } from "~/lib/types";

export const useProjects = routeLoader$(async ({ platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db);
  const stmt = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC");
  const result = await stmt.all<Project>();
  return result.results ?? [];
});

export const useCreateProject = routeAction$(async (data, { platform }) => {
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db);
  const stmt = db.prepare(
    "INSERT INTO projects (name, description, font_family, prefix) VALUES (?, ?, ?, ?)"
  );
  stmt.bind(data.name, data.description ?? null, data.font_family ?? "iconfont", data.prefix ?? "icon-");
  const result = await stmt.run();
  return { success: result.success, id: result.meta?.last_row_id };
});

export default component$(() => {
  const projects = useProjects();
  const createProject = useCreateProject();
  const nav = useNavigate();
  const showModal = useSignal(false);

  return (
    <div class="min-h-screen bg-base-200">
      {/* Header */}
      <div class="navbar bg-base-100 shadow-sm">
        <div class="flex-1">
          <a class="btn btn-ghost text-xl font-bold">Iconfont</a>
        </div>
        <div class="flex-none gap-2">
          <button
            class="btn btn-primary btn-sm"
            onClick$={() => (showModal.value = true)}
          >
            + 新建项目
          </button>
        </div>
      </div>

      {/* Main */}
      <div class="container mx-auto px-4 py-8">
        <h1 class="text-2xl font-bold mb-6">我的项目</h1>

        {projects.value.length === 0 ? (
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body items-center text-center">
              <h2 class="card-title">还没有项目</h2>
              <p class="text-gray-500">点击右上角"新建项目"开始创建你的第一个图标库</p>
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.value.map((project) => (
              <div
                key={project.id}
                class="card bg-base-100 shadow hover:shadow-lg cursor-pointer transition-shadow"
                onClick$={() => nav(`/project/${project.id}`)}
              >
                <div class="card-body">
                  <h2 class="card-title">{project.name}</h2>
                  {project.description && (
                    <p class="text-sm text-gray-500">{project.description}</p>
                  )}
                  <div class="flex gap-2 mt-2">
                    <span class="badge badge-outline">Font: {project.font_family}</span>
                    <span class="badge badge-outline">Prefix: {project.prefix}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showModal.value && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">新建项目</h3>
            <Form action={createProject}>
              <div class="form-control mb-3">
                <label class="label">
                  <span class="label-text">项目名称 *</span>
                </label>
                <input
                  name="name"
                  type="text"
                  class="input input-bordered"
                  placeholder="例如: my-icons"
                  required
                />
              </div>
              <div class="form-control mb-3">
                <label class="label">
                  <span class="label-text">描述</span>
                </label>
                <input
                  name="description"
                  type="text"
                  class="input input-bordered"
                  placeholder="项目描述（可选）"
                />
              </div>
              <div class="form-control mb-3">
                <label class="label">
                  <span class="label-text">Font Family</span>
                </label>
                <input
                  name="font_family"
                  type="text"
                  class="input input-bordered"
                  placeholder="iconfont"
                  value="iconfont"
                />
              </div>
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">Class 前缀</span>
                </label>
                <input
                  name="prefix"
                  type="text"
                  class="input input-bordered"
                  placeholder="icon-"
                  value="icon-"
                />
              </div>
              <div class="modal-action">
                <button
                  type="button"
                  class="btn"
                  onClick$={() => (showModal.value = false)}
                >
                  取消
                </button>
                <button type="submit" class="btn btn-primary">
                  创建
                </button>
              </div>
            </Form>
            {createProject.value?.success && (
              <div class="mt-2 text-green-600 text-sm">
                项目创建成功！
              </div>
            )}
          </div>
          <div
            class="modal-backdrop"
            onClick$={() => (showModal.value = false)}
          />
        </div>
      )}
    </div>
  );
});
