import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { signIn, getSession } from "~/lib/auth-client";

export default component$(() => {
  const email = useSignal("");
  const password = useSignal("");
  const error = useSignal("");
  const loading = useSignal(false);
  const nav = useNavigate();

  // Redirect if already logged in
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const { data } = await getSession();
    if (data?.session) {
      nav("/");
    }
  });

  const handleSubmit = $(async () => {
    if (!email.value || !password.value) {
      error.value = "请填写邮箱和密码";
      return;
    }
    loading.value = true;
    error.value = "";

    const { data, error: authError } = await signIn({
      email: email.value,
      password: password.value,
    });

    loading.value = false;

    if (authError) {
      error.value = authError.message;
      return;
    }

    if (data?.session) {
      // Migrate localStorage projects to server
      await migrateLocalProjects();
      nav("/");
    }
  });

  return (
    <div class="bg-base-200 flex min-h-screen items-center justify-center">
      <div class="card bg-base-100 w-full max-w-md shadow-lg">
        <div class="card-body">
          <div class="mb-4 text-center">
            <h1 class="text-2xl font-bold">登录</h1>
            <p class="text-base-content/60 mt-1 text-sm">
              登录后项目将保存到云端
            </p>
          </div>

          {error.value && (
            <div class="alert alert-error mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error.value}</span>
            </div>
          )}

          <form preventdefault:submit onSubmit$={handleSubmit}>
            <div class="form-control mb-3">
              <label class="label">
                <span class="label-text">邮箱</span>
              </label>
              <input
                type="email"
                class="input input-bordered w-full"
                placeholder="your@email.com"
                value={email.value}
                onInput$={(ev: any) => (email.value = ev.target.value)}
              />
            </div>

            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text">密码</span>
              </label>
              <input
                type="password"
                class="input input-bordered w-full"
                placeholder="••••••••"
                value={password.value}
                onInput$={(ev: any) => (password.value = ev.target.value)}
              />
            </div>

            <button
              type="submit"
              class={`btn btn-primary w-full ${loading.value ? "loading" : ""}`}
              disabled={loading.value}
            >
              {loading.value ? "登录中..." : "登录"}
            </button>
          </form>

          <div class="divider">或</div>

          <p class="text-center text-sm">
            还没有账号？{" "}
            <a href="/register" class="link link-primary">
              注册
            </a>
          </p>

          <p class="text-center text-sm">
            <a href="/" class="link text-base-content/60">
              继续匿名使用
            </a>
          </p>
        </div>
      </div>
    </div>
  );
});

/**
 * Migrate localStorage projects to the server after login.
 */
async function migrateLocalProjects() {
  try {
    const raw = localStorage.getItem("iconfont_projects");
    if (!raw) return;

    const projects = JSON.parse(raw);
    if (!Array.isArray(projects) || projects.length === 0) return;

    for (const project of projects) {
      // Create project on server
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

      // Migrate icons if they exist in localStorage
      const iconsKey = `iconfont_icons_${project.id}`;
      const iconsRaw = localStorage.getItem(iconsKey);
      if (!iconsRaw) continue;

      const icons = JSON.parse(iconsRaw);
      if (!Array.isArray(icons)) continue;

      for (const icon of icons) {
        const iconFormData = new FormData();
        iconFormData.append("name", icon.name);
        iconFormData.append("content", icon.content);
        if (icon.unicode) iconFormData.append("unicode", icon.unicode);
        if (icon.tags) iconFormData.append("tags", icon.tags);
        await fetch(`/api/projects/${newProjectId}/icons`, {
          method: "POST",
          body: iconFormData,
        });
      }
    }

    // Clear localStorage after migration
    localStorage.removeItem("iconfont_projects");
    // Clear icon storage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("iconfont_icons_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Silent fail — user can still use the app
  }
}
