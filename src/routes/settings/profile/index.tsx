import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  Form,
  routeAction$,
  zod$,
  z,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { getSessionFromRequest } from "~/lib/session";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";
import { UserMenu } from "~/components/user-menu/user-menu";
import { MobileNav } from "~/components/mobile-nav/mobile-nav";
export const head: DocumentHead = {
  title: "账户设置 - Iconfont",
  meta: [
    {
      name: "description",
      content: "管理你的 Iconfont 个人资料、API Token 和密码安全选项。",
    },
  ],
};

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export const useProfile = routeLoader$(
  async ({ platform, request, redirect }): Promise<UserProfile> => {
    const session = await getSessionFromRequest(platform, request);
    if (!session) throw redirect(302, "/login?redirect=/settings/profile");
    return {
      id: session.user.id,
      name: session.user.name || "",
      email: session.user.email || "",
      image: session.user.image || null,
    };
  },
);

export const useUpdateProfile = routeAction$(
  async (data, { platform, request }) => {
    const session = await getSessionFromRequest(platform, request);
    if (!session) return { success: false, error: "未登录" };

    const { getDB, initDB } = await import("~/lib/db");
    const db = getDB(platform);
    await initDB(db, platform);
    const { user } = await import("~/lib/schema");
    const { eq } = await import("drizzle-orm");

    await db
      .update(user)
      .set({
        name: data.name,
        image: data.image || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(user.id, session.user.id));

    return { success: true };
  },
  zod$({
    name: z.string().min(1, "姓名不能为空").max(50, "姓名过长"),
    image: z.string().url("请输入有效的图片链接").optional().or(z.literal("")),
  }),
);

export const useChangePassword = routeAction$(
  async (data, { platform, request }) => {
    const session = await getSessionFromRequest(platform, request);
    if (!session) return { success: false, error: "未登录" };

    // Use better-auth to change password
    const { createAuth } = await import("~/lib/auth");
    const auth = createAuth(platform);
    if (!auth) return { success: false, error: "认证服务不可用" };

    try {
      // better-auth changePassword endpoint
      const res = await auth.api.changePassword({
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          revokeOtherSessions: false,
        },
        headers: request.headers,
      });
      if (!res) return { success: false, error: "修改失败" };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "密码错误" };
    }
  },
  zod$({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z.string().min(8, "新密码至少8位"),
    confirmPassword: z.string().min(8),
  }),
);

export default component$(() => {
  const profile = useProfile();
  const updateAction = useUpdateProfile();
  const pwAction = useChangePassword();

  const tab = useSignal<"profile" | "password" | "tokens">("profile");
  const saveSuccess = useSignal(false);
  const pwSuccess = useSignal(false);

  // Token management state
  const tokens = useSignal<
    {
      id: number;
      name: string;
      created_at: string;
      last_used_at: string | null;
    }[]
  >([]);
  const newToken = useSignal<string | null>(null);
  const tokenLoading = useSignal(false);

  // Fetch tokens
  useTask$(async () => {
    if (typeof window === "undefined") return;
    const res = await fetch("/api/tokens");
    if (res.ok) {
      const data = (await res.json()) as any;
      tokens.value = data.tokens || [];
    }
  });

  return (
    <div class="min-h-screen">
      {/* Navbar */}
      <header class="clay-navbar sticky top-0 z-30">
        <div class="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
          <a href="/" class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-md bg-rose-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span class="text-lg font-extrabold tracking-tight text-rose-600">
              Iconfont
            </span>
          </a>
          <div class="flex items-center gap-3">
            <ThemeToggle />
            <MobileNav />
            <a
              href="/"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              首页
            </a>
            <a
              href="/explore"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              探索
            </a>
            <a
              href="/favorites"
              class="rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)]"
            >
              收藏
            </a>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Header */}
      <section class="border-b border-[var(--color-base-300)]">
        <div class="mx-auto max-w-2xl px-4 py-6 sm:px-6">
          {/* Breadcrumb */}
          <nav class="mb-3 flex items-center gap-1.5 text-sm text-[var(--color-base-400)]">
            <a
              href="/"
              class="text-rose-500 transition-all hover:text-rose-700"
            >
              首页
            </a>
            <span>/</span>
            <span class="font-medium text-[var(--color-neutral)]">
              个人资料
            </span>
          </nav>
          <h1 class="text-2xl font-extrabold text-[var(--color-neutral)]">
            账户设置
          </h1>
          <p class="mt-1 text-sm text-[var(--color-base-400)]">
            管理你的个人信息与安全选项
          </p>
        </div>
      </section>

      <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Tab nav */}
        <div class="mb-6 flex rounded-sm border border-[var(--color-base-300)] bg-[var(--color-base-100)] p-1 text-sm">
          {(
            [
              { key: "profile", label: "个人资料" },
              { key: "password", label: "修改密码" },
              { key: "tokens", label: "API Token" },
            ] as { key: "profile" | "password" | "tokens"; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              class={`flex-1 rounded-sm py-2 font-medium transition-all ${
                tab.value === key
                  ? "bg-[var(--color-base-200)]0 text-white"
                  : "text-[var(--color-neutral)] hover:bg-[var(--color-base-200)]"
              }`}
              onClick$={() => (tab.value = key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab.value === "profile" && (
          <div class="rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] p-6">
            {/* Avatar preview */}
            <div class="mb-6 flex items-center gap-4">
              <div class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--color-base-200)] text-2xl font-bold text-[var(--color-neutral)]">
                {profile.value.image ? (
                  <img
                    src={profile.value.image}
                    alt="avatar"
                    class="h-full w-full object-cover"
                    width={64}
                    height={64}
                  />
                ) : (
                  profile.value.name.charAt(0).toUpperCase() || "?"
                )}
              </div>
              <div>
                <p class="font-semibold text-[var(--color-neutral)]">
                  {profile.value.name}
                </p>
                <p class="text-sm text-[var(--color-base-400)]">
                  {profile.value.email}
                </p>
              </div>
            </div>

            {saveSuccess.value && (
              <div class="mb-4 rounded-sm bg-[var(--color-base-200)] px-4 py-2 text-sm font-medium text-emerald-700">
                ✓ 资料已更新
              </div>
            )}
            {updateAction.value?.success === false && (
              <div class="mb-4 rounded-sm bg-red-50 px-4 py-2 text-sm text-red-700">
                {updateAction.value.error}
              </div>
            )}

            <Form
              action={updateAction}
              onSubmitCompleted$={() => {
                if (updateAction.value?.success) {
                  saveSuccess.value = true;
                  setTimeout(() => (saveSuccess.value = false), 3000);
                }
              }}
              class="space-y-4"
            >
              <div>
                <label class="mb-1.5 block text-sm font-semibold text-[var(--color-neutral)]">
                  显示名称
                </label>
                <input
                  name="name"
                  type="text"
                  defaultValue={profile.value.name}
                  class="input-clay w-full px-4 py-2.5 text-sm text-[var(--color-neutral)]"
                  placeholder="你的名字"
                />
                {updateAction.value?.fieldErrors?.name && (
                  <p class="mt-1 text-xs text-red-500">
                    {updateAction.value.fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label class="mb-1.5 block text-sm font-semibold text-[var(--color-neutral)]">
                  邮箱地址
                </label>
                <input
                  type="text"
                  value={profile.value.email}
                  disabled
                  class="input-clay w-full cursor-not-allowed px-4 py-2.5 text-sm text-[var(--color-base-400)]"
                />
                <p class="mt-1 text-xs text-[var(--color-base-400)]">
                  邮箱地址暂不支持修改
                </p>
              </div>

              <div>
                <label class="mb-1.5 block text-sm font-semibold text-[var(--color-neutral)]">
                  头像链接
                  <span class="ml-1 text-xs font-normal text-[var(--color-base-400)]">
                    （可选，填入图片 URL）
                  </span>
                </label>
                <input
                  name="image"
                  type="url"
                  defaultValue={profile.value.image || ""}
                  class="input-clay w-full px-4 py-2.5 text-sm text-[var(--color-neutral)]"
                  placeholder="https://example.com/avatar.jpg"
                />
                {updateAction.value?.fieldErrors?.image && (
                  <p class="mt-1 text-xs text-red-500">
                    {updateAction.value.fieldErrors.image}
                  </p>
                )}
              </div>

              <button
                type="submit"
                class="clay-button bg-[var(--color-base-200)]0 w-full rounded-sm py-2.5 text-sm font-bold text-white"
                disabled={updateAction.isRunning}
              >
                {updateAction.isRunning ? "保存中..." : "保存资料"}
              </button>
            </Form>
          </div>
        )}

        {/* API Token tab */}
        {tab.value === "tokens" && (
          <div class="rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] p-6">
            <h2 class="mb-4 text-lg font-extrabold text-[var(--color-neutral)]">
              API Token
            </h2>
            <p class="mb-4 text-sm text-[var(--color-base-400)]">
              使用 Token 以程序化方式访问你的项目数据。
            </p>

            {newToken.value && (
              <div class="mb-4 rounded-sm bg-[var(--color-base-200)] p-3 text-sm text-emerald-700">
                <p class="font-semibold">Token 已生成（仅显示一次）:</p>
                <code class="mt-1 block rounded-lg bg-[var(--color-base-100)]/60 p-2 font-mono text-xs break-all">
                  {newToken.value}
                </code>
                <button
                  class="mt-2 text-xs font-semibold text-emerald-600 underline"
                  onClick$={() => {
                    navigator.clipboard.writeText(newToken.value!);
                  }}
                >
                  复制
                </button>
              </div>
            )}

            <button
              class="clay-button bg-[var(--color-base-200)]0 mb-4 flex items-center gap-1.5 rounded-sm px-4 py-2 text-sm font-bold text-white"
              onClick$={async () => {
                tokenLoading.value = true;
                try {
                  const res = await fetch("/api/tokens", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: `Token ${new Date().toLocaleDateString("zh-CN")}`,
                    }),
                  });
                  const data = (await res.json()) as any;
                  if (res.ok) {
                    newToken.value = data.token;
                    tokens.value = [
                      {
                        id: data.id,
                        name: data.name,
                        created_at: new Date().toISOString(),
                        last_used_at: null,
                      },
                      ...tokens.value,
                    ];
                  }
                } finally {
                  tokenLoading.value = false;
                }
              }}
              disabled={tokenLoading.value}
            >
              {tokenLoading.value && (
                <span class="loading loading-spinner loading-xs" />
              )}
              生成新 Token
            </button>

            {tokens.value.length === 0 ? (
              <p class="text-sm text-[var(--color-base-400)]">暂无 Token</p>
            ) : (
              <div class="space-y-2">
                {tokens.value.map((t) => (
                  <div
                    key={t.id}
                    class="flex items-center justify-between rounded-sm border border-[var(--color-base-300)] bg-[var(--color-base-200)] p-3"
                  >
                    <div>
                      <p class="text-sm font-medium text-[var(--color-neutral)]">
                        {t.name}
                      </p>
                      <p class="text-xs text-[var(--color-base-400)]">
                        创建于{" "}
                        {new Date(t.created_at).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    <button
                      class="rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-neutral)] hover:bg-[var(--color-base-200)]"
                      onClick$={async () => {
                        await fetch("/api/tokens", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: t.id }),
                        });
                        tokens.value = tokens.value.filter(
                          (x) => x.id !== t.id,
                        );
                      }}
                    >
                      撤销
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Password tab */}
        {tab.value === "password" && (
          <div class="rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] p-6">
            <h2 class="mb-5 text-lg font-extrabold text-[var(--color-neutral)]">
              修改密码
            </h2>

            {pwSuccess.value && (
              <div class="mb-4 rounded-sm bg-[var(--color-base-200)] px-4 py-2 text-sm font-medium text-emerald-700">
                ✓ 密码已修改
              </div>
            )}
            {pwAction.value?.success === false && (
              <div class="mb-4 rounded-sm bg-red-50 px-4 py-2 text-sm text-red-700">
                {pwAction.value.error || "修改失败，请检查当前密码"}
              </div>
            )}

            <Form
              action={pwAction}
              onSubmitCompleted$={() => {
                if (pwAction.value?.success) {
                  pwSuccess.value = true;
                  setTimeout(() => (pwSuccess.value = false), 3000);
                  const form = document.getElementById(
                    "pw-form",
                  ) as HTMLFormElement | null;
                  form?.reset();
                }
              }}
              class="space-y-4"
              id="pw-form"
            >
              <div>
                <label class="mb-1.5 block text-sm font-semibold text-[var(--color-neutral)]">
                  当前密码
                </label>
                <input
                  name="currentPassword"
                  type="password"
                  class="input-clay w-full px-4 py-2.5 text-sm text-[var(--color-neutral)]"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-semibold text-[var(--color-neutral)]">
                  新密码
                </label>
                <input
                  name="newPassword"
                  type="password"
                  class="input-clay w-full px-4 py-2.5 text-sm text-[var(--color-neutral)]"
                  placeholder="至少 8 位"
                />
                {pwAction.value?.fieldErrors?.newPassword && (
                  <p class="mt-1 text-xs text-red-500">
                    {pwAction.value.fieldErrors.newPassword}
                  </p>
                )}
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-semibold text-[var(--color-neutral)]">
                  确认新密码
                </label>
                <input
                  name="confirmPassword"
                  type="password"
                  class="input-clay w-full px-4 py-2.5 text-sm text-[var(--color-neutral)]"
                  placeholder="再次输入新密码"
                />
              </div>

              <button
                type="submit"
                class="clay-button bg-[var(--color-base-200)]0 w-full rounded-sm py-2.5 text-sm font-bold text-white"
                disabled={pwAction.isRunning}
              >
                {pwAction.isRunning ? "修改中..." : "修改密码"}
              </button>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
});
