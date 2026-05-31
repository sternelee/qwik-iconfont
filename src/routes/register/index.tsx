import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { signUp, getSession, signInSocial } from "~/lib/auth-client";

export default component$(() => {
  const name = useSignal("");
  const email = useSignal("");
  const password = useSignal("");
  const confirmPassword = useSignal("");
  const error = useSignal("");
  const loading = useSignal(false);
  const nav = useNavigate();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const { data } = await getSession();
    if (data?.session) nav("/");
  });

  const handleSubmit = $(async () => {
    if (!name.value || !email.value || !password.value) {
      error.value = "请填写所有必填字段";
      return;
    }
    if (password.value !== confirmPassword.value) {
      error.value = "两次输入的密码不一致";
      return;
    }
    if (password.value.length < 8) {
      error.value = "密码至少需要 8 个字符";
      return;
    }
    loading.value = true;
    error.value = "";
    const { data, error: authError } = await signUp({
      name: name.value,
      email: email.value,
      password: password.value,
    });
    loading.value = false;
    if (authError) {
      error.value = authError.message;
      return;
    }
    if (data?.session) nav("/");
  });

  return (
    <div class="bg-base-200 flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-sm">
        {/* Logo */}
        <a href="/" class="mb-6 flex items-center justify-center gap-2">
          <div class="bg-primary text-primary-content flex h-9 w-9 items-center justify-center rounded-lg">
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
          <span class="text-lg font-semibold">Iconfont</span>
        </a>

        {/* Card */}
        <div class="bg-base-100 rounded-xl p-6 shadow-sm">
          <h1 class="mb-1 text-center text-base font-semibold">注册</h1>
          <p class="text-base-content/50 mb-5 text-center text-sm">
            创建账号，项目将保存到云端
          </p>

          {error.value && (
            <div class="alert alert-error mb-4 py-2 text-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 shrink-0 stroke-current"
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

          <form
            preventdefault:submit
            onSubmit$={handleSubmit}
            class="space-y-3"
          >
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-sm">用户名</span>
              </label>
              <input
                type="text"
                class="input input-bordered input-sm w-full"
                placeholder="你的名字"
                value={name.value}
                onInput$={(ev: any) => (name.value = ev.target.value)}
              />
            </div>
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-sm">邮箱</span>
              </label>
              <input
                type="email"
                class="input input-bordered input-sm w-full"
                placeholder="your@email.com"
                value={email.value}
                onInput$={(ev: any) => (email.value = ev.target.value)}
              />
            </div>
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-sm">密码</span>
              </label>
              <input
                type="password"
                class="input input-bordered input-sm w-full"
                placeholder="至少 8 个字符"
                value={password.value}
                onInput$={(ev: any) => (password.value = ev.target.value)}
              />
            </div>
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-sm">确认密码</span>
              </label>
              <input
                type="password"
                class="input input-bordered input-sm w-full"
                placeholder="再次输入密码"
                value={confirmPassword.value}
                onInput$={(ev: any) =>
                  (confirmPassword.value = ev.target.value)
                }
              />
            </div>
            <button
              type="submit"
              class={`btn btn-primary btn-sm w-full ${loading.value ? "loading" : ""}`}
              disabled={loading.value}
            >
              {loading.value ? "注册中..." : "注册"}
            </button>
          </form>

          {/* OAuth */}
          <div class="mt-3 flex flex-col gap-2">
            <button
              type="button"
              class="btn btn-outline btn-sm flex w-full items-center gap-2"
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
              GitHub 注册
            </button>
            <button
              type="button"
              class="btn btn-outline btn-sm flex w-full items-center gap-2"
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
              Google 注册
            </button>
          </div>

          <div class="divider my-4 text-xs">或</div>

          <div class="space-y-2 text-center text-sm">
            <p>
              已有账号？
              <a href="/login" class="link link-primary">
                登录
              </a>
            </p>
            <p>
              <a href="/" class="link text-base-content/40">
                继续匿名使用
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
