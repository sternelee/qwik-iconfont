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

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const { data } = await getSession();
    if (data?.session) nav("/");
  });

  const handleSubmit = $(async () => {
    if (!name.value || !email.value || !password.value) { error.value = "请填写所有必填字段"; return; }
    if (password.value !== confirmPassword.value) { error.value = "两次输入的密码不一致"; return; }
    if (password.value.length < 8) { error.value = "密码至少需要 8 个字符"; return; }
    loading.value = true;
    error.value = "";
    const { data, error: authError } = await signUp({ name: name.value, email: email.value, password: password.value });
    loading.value = false;
    if (authError) { error.value = authError.message; return; }
    if (data?.session) nav("/");
  });

  return (
    <div class="flex min-h-screen items-center justify-center bg-base-200 px-4">
      <div class="w-full max-w-sm">
        {/* Logo */}
        <a href="/" class="mb-6 flex items-center justify-center gap-2">
          <div class="bg-primary text-primary-content flex h-9 w-9 items-center justify-center rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <span class="text-lg font-semibold">Iconfont</span>
        </a>

        {/* Card */}
        <div class="bg-base-100 rounded-xl p-6 shadow-sm">
          <h1 class="mb-1 text-center text-base font-semibold">注册</h1>
          <p class="text-base-content/50 mb-5 text-center text-sm">创建账号，项目将保存到云端</p>

          {error.value && (
            <div class="alert alert-error mb-4 py-2 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error.value}</span>
            </div>
          )}

          <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-3">
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-sm">用户名</span></label>
              <input type="text" class="input input-bordered input-sm w-full" placeholder="你的名字" value={name.value} onInput$={(ev: any) => (name.value = ev.target.value)} />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-sm">邮箱</span></label>
              <input type="email" class="input input-bordered input-sm w-full" placeholder="your@email.com" value={email.value} onInput$={(ev: any) => (email.value = ev.target.value)} />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-sm">密码</span></label>
              <input type="password" class="input input-bordered input-sm w-full" placeholder="至少 8 个字符" value={password.value} onInput$={(ev: any) => (password.value = ev.target.value)} />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-sm">确认密码</span></label>
              <input type="password" class="input input-bordered input-sm w-full" placeholder="再次输入密码" value={confirmPassword.value} onInput$={(ev: any) => (confirmPassword.value = ev.target.value)} />
            </div>
            <button type="submit" class={`btn btn-primary btn-sm w-full ${loading.value ? "loading" : ""}`} disabled={loading.value}>
              {loading.value ? "注册中..." : "注册"}
            </button>
          </form>

          <div class="divider my-4 text-xs">或</div>

          <div class="space-y-2 text-center text-sm">
            <p>已有账号？<a href="/login" class="link link-primary">登录</a></p>
            <p><a href="/" class="link text-base-content/40">继续匿名使用</a></p>
          </div>
        </div>
      </div>
    </div>
  );
});
