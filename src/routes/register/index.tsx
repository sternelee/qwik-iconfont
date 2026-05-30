import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { signUp, getSession } from "~/lib/auth-client";

export default component$(() => {
  const name = useSignal("");
  const email = useSignal("");
  const password = useSignal("");
  const confirmPassword = useSignal("");
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

    if (data?.session) {
      nav("/");
    }
  });

  return (
    <div class="bg-base-200 flex min-h-screen items-center justify-center">
      <div class="card bg-base-100 w-full max-w-md shadow-lg">
        <div class="card-body">
          <div class="mb-4 text-center">
            <h1 class="text-2xl font-bold">注册</h1>
            <p class="text-base-content/60 mt-1 text-sm">
              创建账号，项目将保存到云端
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
                <span class="label-text">用户名</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                placeholder="你的名字"
                value={name.value}
                onInput$={(ev: any) => (name.value = ev.target.value)}
              />
            </div>

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

            <div class="form-control mb-3">
              <label class="label">
                <span class="label-text">密码</span>
              </label>
              <input
                type="password"
                class="input input-bordered w-full"
                placeholder="至少 8 个字符"
                value={password.value}
                onInput$={(ev: any) => (password.value = ev.target.value)}
              />
            </div>

            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text">确认密码</span>
              </label>
              <input
                type="password"
                class="input input-bordered w-full"
                placeholder="再次输入密码"
                value={confirmPassword.value}
                onInput$={(ev: any) =>
                  (confirmPassword.value = ev.target.value)
                }
              />
            </div>

            <button
              type="submit"
              class={`btn btn-primary w-full ${loading.value ? "loading" : ""}`}
              disabled={loading.value}
            >
              {loading.value ? "注册中..." : "注册"}
            </button>
          </form>

          <div class="divider">或</div>

          <p class="text-center text-sm">
            已有账号？{" "}
            <a href="/login" class="link link-primary">
              登录
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
