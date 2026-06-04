import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { ThemeToggle } from "~/components/theme-toggle/theme-toggle";
import { UserMenu } from "~/components/user-menu/user-menu";

export const head: DocumentHead = {
  title: "隐私政策 - Iconfont",
  meta: [
    {
      name: "description",
      content:
        "Iconfont 隐私政策：说明我们如何收集、使用、存储和保护您的个人信息。",
    },
  ],
};

export default component$(() => {
  return (
    <div class="min-h-screen">
      {/* Navbar */}
      <header class="clay-navbar sticky top-0 z-30">
        <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
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
            <a
              href="/explore"
              class="hidden rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-neutral)] transition-all hover:bg-[var(--color-base-200)] sm:block"
            >
              探索
            </a>
            <UserMenu />
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div class="mb-10 text-center">
          <h1 class="text-3xl font-black tracking-tight text-[var(--color-neutral)] sm:text-4xl">
            隐私政策
          </h1>
          <p class="mt-3 text-sm text-[var(--color-base-400)]">
            最后更新日期：2026年6月3日
          </p>
        </div>

        <article class="prose prose-sm max-w-none text-[var(--color-base-400)]">
          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              1. 引言
            </h2>
            <p class="mt-2 leading-relaxed">
              Iconfont（"我们"、"平台"）重视用户的隐私保护。本隐私政策旨在说明我们如何收集、使用、存储和保护您的个人信息。使用本平台即表示您同意本政策的条款。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              2. 我们收集的信息
            </h2>
            <p class="mt-2 leading-relaxed">我们可能收集以下类型的信息：</p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong class="text-[var(--color-neutral)]">账户信息：</strong>
                注册时提供的邮箱、用户名、密码哈希（我们不会存储明文密码）。
              </li>
              <li>
                <strong class="text-[var(--color-neutral)]">
                  OAuth 信息：
                </strong>
                通过 GitHub 或 Google
                登录时，我们获取的公开资料（头像、昵称等）。
              </li>
              <li>
                <strong class="text-[var(--color-neutral)]">项目数据：</strong>
                您上传的 SVG 图标、项目名称、描述、配置等。
              </li>
              <li>
                <strong class="text-[var(--color-neutral)]">使用数据：</strong>
                浏览器类型、IP
                地址、访问时间等用于服务稳定性和安全性的日志信息。
              </li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              3. 信息的使用
            </h2>
            <p class="mt-2 leading-relaxed">我们使用收集的信息用于：</p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li>提供、维护和改进平台服务</li>
              <li>验证用户身份，保障账户安全</li>
              <li>发送服务通知（如安全警报、功能更新）</li>
              <li>分析使用趋势，优化产品体验</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              4. 信息的存储与安全
            </h2>
            <p class="mt-2 leading-relaxed">
              您的数据存储在 Cloudflare 的数据中心（D1 数据库和 R2
              对象存储）。我们采取合理的安全措施保护数据，包括传输层加密（HTTPS）和数据库访问控制。但请注意，互联网传输不存在绝对安全。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              5. 数据共享与披露
            </h2>
            <p class="mt-2 leading-relaxed">
              我们不会将您的个人信息出售给第三方。仅在以下情况下可能披露信息：
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li>获得您的明确同意</li>
              <li>遵守法律法规或响应合法请求</li>
              <li>保护平台、用户或公众的权利、财产或安全</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              6. Cookie 与本地存储
            </h2>
            <p class="mt-2 leading-relaxed">
              我们使用 Cookie
              和浏览器本地存储（localStorage）来保持登录状态、记录主题偏好和存储匿名模式下的项目数据。您可以通过浏览器设置清除这些数据。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              7. 第三方服务
            </h2>
            <p class="mt-2 leading-relaxed">
              我们集成了以下第三方服务，其隐私政策独立于本平台：
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li>GitHub OAuth（登录认证）</li>
              <li>Google OAuth（登录认证）</li>
              <li>Cloudflare（基础设施托管）</li>
              <li>Resend（可选的邮件服务）</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              8. 您的权利
            </h2>
            <p class="mt-2 leading-relaxed">
              您有权访问、更正或删除您的个人数据。如需删除账户及关联数据，请联系管理员或在设置中操作。匿名模式下的数据完全由您控制，清除浏览器数据即可删除。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              9. 政策更新
            </h2>
            <p class="mt-2 leading-relaxed">
              我们可能会不时更新本隐私政策。重大变更时，我们将在平台内通知您。建议您定期查看本页面以了解最新政策。
            </p>
          </section>

          <section>
            <h2 class="text-lg font-bold text-[var(--color-neutral)]">
              10. 联系我们
            </h2>
            <p class="mt-2 leading-relaxed">
              如有任何隐私相关问题，请通过 GitHub Issues 与我们联系。
            </p>
          </section>
        </article>
      </main>
    </div>
  );
});
