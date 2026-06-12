import { component$, useSignal, $, useTask$ } from "@builder.io/qwik";
import { useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { signIn, getSession, signInSocial } from "~/lib/auth-client";
import { migrateLocalProjects } from "~/lib/local-migration";
export const head: DocumentHead = {
  title: "登录 - Iconfont",
  meta: [
    {
      name: "description",
      content: "登录 Iconfont，将项目保存到云端。",
    },
  ],
};

export default component$(() => {
  const email = useSignal("");
  const password = useSignal("");
  const error = useSignal("");
  const loading = useSignal(false);
  const nav = useNavigate();

  // Session check + redirect
  useTask$(async () => {
    if (typeof window === "undefined") return;
    const { data } = await getSession();
    if (data?.session) nav("/");
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
    if (authError) {
      loading.value = false;
      error.value = authError.message;
      return;
    }
    if (data) {
      // Fire-and-forget: migrate local projects in background
      migrateLocalProjects();
      nav("/");
    } else {
      loading.value = false;
    }
  });

  return (
    <div class="flex min-h-screen items-center justify-center bg-[var(--color-base-200)] px-4">
      <div class="w-full max-w-sm">
        {/* Logo */}
        <a href="/" class="mb-6 flex items-center justify-center gap-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-md bg-rose-500 text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <span class="text-lg font-bold tracking-tight text-[var(--color-neutral)]">
            Iconfont
          </span>
        </a>

        {/* Card */}
        <div class="clay-card p-6">
          <h1 class="mb-1 text-center text-base font-bold text-[var(--color-neutral)]">
            登录
          </h1>
          <p class="mb-5 text-center text-sm text-[var(--color-base-400)]">
            登录后项目将保存到云端
          </p>

          {error.value && (
            <div class="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error.value}</span>
            </div>
          )}

          <form
            preventdefault:submit
            onSubmit$={handleSubmit}
            class="space-y-3"
          >
            <div>
              <label class="mb-1 block text-sm font-medium text-[var(--color-neutral)]">
                邮箱
              </label>
              <input
                type="email"
                class="input-clay w-full px-4 py-2.5 text-sm"
                placeholder="your@email.com"
                value={email.value}
                onInput$={(ev: any) => (email.value = ev.target.value)}
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-[var(--color-neutral)]">
                密码
              </label>
              <input
                type="password"
                class="input-clay w-full px-4 py-2.5 text-sm"
                placeholder="••••••••"
                value={password.value}
                onInput$={(ev: any) => (password.value = ev.target.value)}
              />
            </div>
            <button
              type="submit"
              class={`clay-button w-full bg-rose-500 px-4 py-2.5 text-sm text-white ${loading.value ? "opacity-70" : ""}`}
              disabled={loading.value}
            >
              {loading.value ? "登录中..." : "登录"}
            </button>
          </form>

          <div class="relative my-5 text-center">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-[var(--color-base-300)]" />
            </div>
            <span class="relative bg-[var(--color-base-100)] px-2 text-xs text-[var(--color-base-400)]">
              或
            </span>
          </div>

          {/* OAuth */}
          <div class="flex flex-col gap-2">
            <button
              type="button"
              class="clay-button-secondary flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-4 py-2.5 text-sm text-[var(--color-neutral)] transition-all hover:border-[var(--color-base-300)] hover:bg-[var(--color-base-200)]"
              onClick$={() => signInSocial("github")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub 登录
            </button>
            <button
              type="button"
              class="clay-button-secondary flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-4 py-2.5 text-sm text-[var(--color-neutral)] transition-all hover:border-[var(--color-base-300)] hover:bg-[var(--color-base-200)]"
              onClick$={() => signInSocial("google")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google 登录
            </button>
          </div>

          <div class="relative my-5 text-center">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-[var(--color-base-300)]" />
            </div>
            <span class="relative bg-[var(--color-base-100)] px-2 text-xs text-[var(--color-base-400)]">
              或
            </span>
          </div>

          <div class="space-y-2 text-center text-sm">
            <p class="text-[var(--color-base-400)]">
              还没有账号？
              <a
                href="/register"
                class="font-medium text-rose-600 transition-colors hover:text-rose-700"
              >
                注册
              </a>
            </p>
            <p>
              <a
                href="/"
                class="text-sm text-[var(--color-base-400)] transition-colors hover:text-rose-600"
              >
                继续匿名使用
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
